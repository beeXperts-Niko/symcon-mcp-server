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
            return;
        }

        $this->startProcess($port, $apiUrl, $apiKey);
    }

    public function GetConfigurationForm(): string
    {
        $form = json_decode(file_get_contents(__DIR__ . '/form.json'), true);
        if (!is_array($form)) {
            return '[]';
        }
        return json_encode($form);
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
    }

    private function startProcess(int $port, string $apiUrl, string $apiKey = ''): void
    {
        $mcpPath = $this->getMcpServerPath();
        $nodePath = $mcpPath . '/dist/index.js';
        if (!is_file($nodePath)) {
            $nodePath = $mcpPath . '/index.js';
        }
        if (!is_file($nodePath)) {
            IPS_LogMessage('MCPServer', 'Node entry not found: ' . $nodePath);
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
            IPS_LogMessage('MCPServer', 'Failed to start MCP server process');
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
        }
    }
}
