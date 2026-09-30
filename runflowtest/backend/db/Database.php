<?php
/**
 * Database Connection & Utility Class
 */

class Database {
  private $pdo;
  private static $instance = null;

  private function __construct() {
    try {
      if (DB_TYPE === 'sqlite') {
        $this->pdo = new PDO('sqlite:' . DB_PATH);
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->exec('PRAGMA foreign_keys = ON');
      } else {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME;
        $this->pdo = new PDO($dsn, DB_USER, DB_PASS);
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
      }
    } catch (PDOException $e) {
      http_response_code(500);
      die(json_encode(['error' => 'Database connection failed']));
    }
  }

  public static function getInstance() {
    if (self::$instance === null) {
      self::$instance = new self();
    }
    return self::$instance;
  }

  public function getConnection() {
    return $this->pdo;
  }

  public function query($sql, $params = []) {
    try {
      $stmt = $this->pdo->prepare($sql);
      $stmt->execute($params);
      return $stmt;
    } catch (PDOException $e) {
      if (DEBUG) {
        throw $e;
      }
      http_response_code(500);
      die(json_encode(['error' => 'Database query failed']));
    }
  }

  public function fetchOne($sql, $params = []) {
    $stmt = $this->query($sql, $params);
    return $stmt->fetch(PDO::FETCH_ASSOC);
  }

  public function fetchAll($sql, $params = []) {
    $stmt = $this->query($sql, $params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
  }

  public function insert($table, $data) {
    $cols = implode(', ', array_keys($data));
    $placeholders = implode(', ', array_fill(0, count($data), '?'));
    $sql = "INSERT INTO $table ($cols) VALUES ($placeholders)";
    $this->query($sql, array_values($data));
    return $this->pdo->lastInsertId();
  }

  public function update($table, $data, $where, $whereParams = []) {
    $set = implode(', ', array_map(fn($k) => "$k = ?", array_keys($data)));
    $sql = "UPDATE $table SET $set WHERE $where";
    $params = array_merge(array_values($data), $whereParams);
    return $this->query($sql, $params);
  }

  public function delete($table, $where, $params = []) {
    $sql = "DELETE FROM $table WHERE $where";
    return $this->query($sql, $params);
  }

  public function cleanupExpiredData() {
    $now = date('Y-m-d H:i:s');

    $this->delete('sessions', 'expires_at < ?', [$now]);
    $this->delete('simulations', 'expires_at < ?', [$now]);
    $this->delete('reports', 'expires_at < ?', [$now]);
    $this->delete('personas', 'expires_at < ?', [$now]);
    $this->delete('projects', 'expires_at < ?', [$now]);
    $this->delete('users', 'expires_at < ? AND email_verified = 1', [$now]);
  }

  public function initDatabase() {
    if (DB_TYPE === 'sqlite' && !file_exists(DB_PATH)) {
      $schema = file_get_contents(__DIR__ . '/../../sql/schema.sql');
      $this->pdo->exec($schema);
    }
  }
}
