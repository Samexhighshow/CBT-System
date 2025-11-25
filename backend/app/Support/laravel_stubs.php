<?php

// Minimal stubs for Laravel core classes and third-party traits used in the project.
// These are only for static analysis in the workspace and do not replace real vendor packages.

namespace Illuminate\Database\Eloquent {
    class Model
    {
        public function hasMany($related, $foreignKey = null, $localKey = null) {}
        public function belongsTo($related, $foreignKey = null, $ownerKey = null, $relation = null) {}
        public function belongsToMany($related, $table = null, $foreignPivotKey = null, $relatedPivotKey = null, $parentKey = null, $relatedKey = null, $relation = null) {}
        public function hasOne($related, $foreignKey = null, $localKey = null) {}
        public function morphToMany($related, $name, $table = null, $foreignPivotKey = null, $relatedPivotKey = null) {}
        public static function query() { return new static(); }

        // Common Eloquent-like static helpers for static analysis only
        public static function where($col, $op = null, $val = null) { return new static(); }
        public static function with($relations) { return new static(); }
        public static function findOrFail($id) { return new static(); }
        public static function find($id) { return new static(); }
        public static function create($attrs = []) { return new static(); }
        public static function firstOrCreate($attrs = []) { return new static(); }
        public static function first() { return new static(); }
        public static function exists() { return false; }
        public static function get() { return []; }
        public static function all() { return []; }
        public function save() { return true; }
        public static function whereBetween($col, $range) { return new static(); }
        public function __get($name) { return null; }
        public static function pluck($col) { return new static(); }
        public function toArray() { return []; }
    }
}

namespace Illuminate\Foundation\Auth {
    use Illuminate\Database\Eloquent\Model;
    class User extends Model {}
}

namespace Illuminate\Notifications {
    trait Notifiable { public function notify($instance = null) {} }
}

namespace Laravel\Sanctum {
    trait HasApiTokens { public function createToken($name, $abilities = []) { return (object)['plainTextToken' => 'token']; } }
}

namespace Spatie\Permission\Traits {
    trait HasRoles { public function hasRole($roles) { if (is_array($roles)) { foreach ($roles as $r) { if ($this->hasRole($r)) return true; } return false; } return false; } }
}

namespace Illuminate\Support\Facades {
    class Route
    {
        public static function __callStatic($name, $arguments) { return null; }
        public static function middleware($middleware)
        {
            return new class {
                public function group($cb) { /* no-op */ }
            };
        }
    }
}

// Minimal stub for Carbon date handling used in code (Carbon extends DateTime in real project)
namespace Carbon {
    class Carbon extends \DateTime {
        public function subMonth() { return $this; }
        public function toDateString() { return (new \DateTime())->format('Y-m-d'); }
    }
}

// End of stubs

// Global helper stubs
namespace {
    function response()
    {
        return new class {
            public function json($data = [], $status = 200) { return null; }
        };
    }

    function now()
    {
        return new \Carbon\Carbon();
    }

    function auth()
    {
        return new class {
            public function user() { return new class { public function hasRole($roles) { return false; } public $student; public $student_id; }; }
            public function id() { return 1; }
        };
    }
}

namespace Illuminate\Http {
    class Request { public $email; public $password; public function __construct() {} public function validate($rules = []) { return []; } public function query($key, $default = null) { return $default; } }
}

namespace Illuminate\Support\Facades {
    class Hash { public static function check($value, $hashedValue) { return false; } public static function make($value) { return 'hashed'; } }
    class DB { public static function beginTransaction() {} public static function commit() {} public static function rollBack() {} }
    class Schema { public static function create($table, $cb) {} public static function dropIfExists($table) {} }
}

namespace Illuminate\Database\Migrations {
    class Migration {}
}

namespace Illuminate\Database\Schema {
    class Blueprint {
        public function increments($col) {}
        public function string($col, $len = 255) {}
        public function timestamps() {}
        public function integer($col) {}
        public function boolean($col) {}
        public function text($col) {}
        public function foreignId($col) { return $this; }
        public function constrained() { return $this; }
        public function id() {}
        public function rememberToken() {}
        public function json($col) {}
        public function timestamp($col) {}
        public function unique($cols) {}
    }
}

namespace Illuminate\Database {
    class Seeder {}
}

namespace Spatie\Permission\Models {
    class Role { public static function firstOrCreate($attrs = []) { return new static(); } }
    class Permission { public static function firstOrCreate($attrs = []) { return new static(); } }
}

