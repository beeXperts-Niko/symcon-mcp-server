<?php

declare(strict_types=1);

/**
 * Symcon MCP Server Module
 *
 * Starts and manages a Node.js MCP server that exposes the Symcon JSON-RPC API as MCP tools.
 * Complies with IP-Symcon SDK: IPSModule, module.json, form.json, locale.
 */

/**
 * Base class: IPSModuleStrict (Symcon 8.1+) or IPSModule (Symcon 5.0+).
 */
class MCPServer extends IPSModule
{
    private const DEFAULT_PORT = 4096;
    private const DEFAULT_API_URL = 'http://127.0.0.1:3777/api/';

    public function Create(): void
    {
        parent::Create();
        $this->RegisterPropertyInteger('Port', self::DEFAULT_PORT);
        $this->RegisterPropertyString('SymconApiUrl', self::DEFAULT_API_URL);
        $this->RegisterPropertyString('ApiKey', $this->generateApiKey());
        $this->RegisterPropertyBoolean('Active', true);
    }

    private function generateApiKey(): string
    {
        return bin2hex(random_bytes(32));
    }

    public function Destroy(): void
    {
        $this->stopProcess();
        parent::Destroy();
    }

    public function ApplyChanges(): void
    {
        parent::ApplyChanges();
        $this->stopProcess();

        $port = (int) $this->ReadPropertyInteger('Port');
        $apiUrl = trim((string) $this->ReadPropertyString('SymconApiUrl'));
        $apiKey = trim((string) $this->ReadPropertyString('ApiKey'));
        $active = (bool) $this->ReadPropertyBoolean('Active');

        // Leeren API-Key automatisch erzeugen und in die Konfiguration schreiben (damit er im Formular angezeigt wird)
        if ($apiKey === '') {
            $apiKey = $this->generateApiKey();
            $config = IPS_GetConfiguration($this->InstanceID);
            $data = json_decode($config, true);
            if (is_array($data)) {
                $data['ApiKey'] = $apiKey;
                IPS_SetConfiguration($this->InstanceID, json_encode($data));
                IPS_ApplyChanges($this->InstanceID);
            }
        }

        if (!$active || $port < 1024 || $port > 65535 || $apiUrl === '') {
            if (!$active) {
                $this->mcpLog('MCP-Server deaktiviert („Aktiv“ aus). Nicht gestartet.');
            } elseif ($port < 1024 || $port > 65535) {
                $this->mcpLog('Ungültiger Port ' . $port . '. MCP-Server nicht gestartet.');
            } else {
                $this->mcpLog('Symcon-API-URL fehlt. MCP-Server nicht gestartet.');
            }
            return;
        }

        $this->startProcess($port, $apiUrl, $apiKey);
    }

    public function GetConfigurationForm(): string
    {
        $formPath = __DIR__ . '/form.json';
        $form = is_file($formPath) ? json_decode((string) file_get_contents($formPath), true) : null;
        if (!is_array($form) || !isset($form['elements']) || !is_array($form['elements'])) {
            return json_encode(['elements' => [['type' => 'Label', 'caption' => 'Konfiguration (form.json) nicht geladen.']]]);
        }
        if ($this->InstanceID <= 0) {
            return json_encode($form);
        }
        $port = (int) $this->ReadPropertyInteger('Port');
        $status = $this->getProcessStatus();
        if ($status['running']) {
            $pidInfo = $status['pid'] !== '' ? ' (PID: ' . $status['pid'] . ')' : ' (Port in Benutzung)';
            $statusCaption = '[OK] MCP-Server läuft auf Port ' . $port . $pidInfo . '. MCP-Client (z. B. Claude): http://<SymBox-IP>:' . $port;
        } else {
            $statusCaption = '[--] MCP-Server gestoppt. Aktiv setzen und Änderungen übernehmen klicken.';
        }
        array_unshift($form['elements'], [
            'type'    => 'Label',
            'caption' => $statusCaption,
        ]);
        return json_encode($form);
    }

    /** Liefert ['running' => bool, 'pid' => string] für die Status-Anzeige. Fallback: Port-Check, wenn PID-Check fehlschlägt. */
    private function getProcessStatus(): array
    {
        $port = (int) $this->ReadPropertyInteger('Port');
        $pidFile = $this->getPidFilePath();
        $pid = 0;
        if (is_file($pidFile)) {
            $pid = (int) trim((string) file_get_contents($pidFile));
        }
        $running = $pid > 0 && $this->isProcessRunning($pid);
        if (!$running && $port >= 1024 && $this->isPortListening($port)) {
            $running = true;
            if ($pid <= 0) {
                $pid = 0;
            }
        }
        return ['running' => $running, 'pid' => $pid > 0 ? (string) $pid : ''];
    }

    /** Prüft, ob ein Prozess mit der angegebenen PID läuft. Unter Linux: /proc/<pid>, sonst posix_kill/tasklist. */
    private function isProcessRunning(int $pid): bool
    {
        if (PHP_OS_FAMILY === 'Linux') {
            return is_dir('/proc/' . $pid);
        }
        if (function_exists('posix_kill')) {
            return @posix_kill($pid, 0);
        }
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            return trim((string) @shell_exec('tasklist /FI "PID eq ' . $pid . '" 2>nul')) !== '';
        }
        return false;
    }

    /** Prüft, ob auf dem Port etwas lauscht (Fallback für Status-Anzeige, wenn PID-Check unzuverlässig). */
    private function isPortListening(int $port): bool
    {
        $errno = 0;
        $errstr = '';
        $fp = @stream_socket_client(
            'tcp://127.0.0.1:' . $port,
            $errno,
            $errstr,
            1,
            STREAM_CLIENT_CONNECT
        );
        if (is_resource($fp)) {
            fclose($fp);
            return true;
        }
        return false;
    }

    private function getMcpServerPath(): string
    {
        return realpath(__DIR__ . '/../libs/mcp-server') ?: __DIR__ . '/../libs/mcp-server';
    }

    private function getPidFilePath(): string
    {
        return __DIR__ . '/.mcp_server_' . $this->InstanceID . '.pid';
    }

    private function stopProcess(): void
    {
        $pidFile = $this->getPidFilePath();
        if (!is_file($pidFile)) {
            return;
        }
        $pid = (int) trim((string) file_get_contents($pidFile));
        if ($pid <= 0) {
            @unlink($pidFile);
            return;
        }
        $this->mcpLog('MCP-Server wird beendet (PID ' . $pid . ').');
        if (function_exists('posix_kill')) {
            @posix_kill($pid, (defined('SIGTERM') ? SIGTERM : 15));
        } else {
            if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
                @exec('taskkill /PID ' . $pid . ' /F 2>nul');
            } else {
                @exec('kill ' . $pid . ' 2>/dev/null');
            }
        }
        @unlink($pidFile);
        $this->mcpLog('MCP-Server gestoppt.');
    }

    private function startProcess(int $port, string $apiUrl, string $apiKey = ''): void
    {
        $mcpPath = $this->getMcpServerPath();
        $nodePath = $mcpPath . '/dist/index.js';
        if (!is_file($nodePath)) {
            $nodePath = $mcpPath . '/index.js';
        }
        if (!is_file($nodePath)) {
            $this->mcpLog('FEHLER: Node-Einstieg nicht gefunden: ' . $nodePath);
            return;
        }

        $env = [
            'MCP_PORT' => (string) $port,
            'SYMCON_API_URL' => $apiUrl,
        ];
        if ($apiKey !== '') {
            $env['MCP_AUTH_TOKEN'] = $apiKey;
        }
        $pidFile = $this->getPidFilePath();

        $cmd = sprintf(
            'cd %s && MCP_PORT=%s SYMCON_API_URL=%s node %s >> /dev/null 2>&1 & echo $!',
            escapeshellarg($mcpPath),
            escapeshellarg((string) $port),
            escapeshellarg($apiUrl),
            escapeshellarg(basename($nodePath))
        );
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            $cmd = sprintf(
                'start /B node %s',
                escapeshellarg($nodePath)
            );
        }

        $spec = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $procEnv = array_merge($_ENV ?? [], $env);
        $proc = @proc_open(
            $cmd,
            $spec,
            $pipes,
            $mcpPath,
            $procEnv
        );
        if (!is_resource($proc)) {
            $this->mcpLog('FEHLER: MCP-Server-Prozess konnte nicht gestartet werden.');
            return;
        }
        fclose($pipes[0]);
        $stdout = stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($proc);

        $pid = (int) trim((string) $stdout);
        if ($pid > 0) {
            file_put_contents($pidFile, (string) $pid);
            $this->mcpLog(sprintf('MCP-Server gestartet: Port %d, PID %d, Symcon-API %s, Auth %s', $port, $pid, $apiUrl, $apiKey !== '' ? 'aktiv' : 'aus'));
        } else {
            $this->mcpLog('FEHLER: Keine PID nach Start erhalten.');
        }
    }

    /** Schreibt ins Instanz-Debug-Protokoll (SendDebug der Elternklasse) und ins allgemeine Log. */
    private function mcpLog(string $message): void
    {
        $this->SendDebug($message);
        IPS_LogMessage('MCPServer', $message);
    }
}
