<?php
// backend/config/db.php

class Database {
    private static ?PDO $instance = null;

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $config = require __DIR__ . '/config.php';
            $dbPath = $config['db_path'];

            $dir = dirname($dbPath);
            if (!is_dir($dir)) {
                mkdir($dir, 0777, true);
            }

            $needsInit = !file_exists($dbPath) || filesize($dbPath) === 0;

            self::$instance = new PDO("sqlite:" . $dbPath);
            self::$instance->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            self::$instance->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            self::$instance->exec("PRAGMA foreign_keys = ON;");
            self::$instance->exec("PRAGMA journal_mode = WAL;");

            require_once __DIR__ . '/../init_db.php';
            if ($needsInit) {
                initializeDatabase(self::$instance);
            } else {
                ensureUsersAndHR(self::$instance);
            }
        }

        return self::$instance;
    }
}
