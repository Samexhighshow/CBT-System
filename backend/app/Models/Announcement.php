<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Announcement extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'content',
        'admin_id',
        'published',
        'published_at',
        'image_url',
    ];

    protected $casts = [
        'published' => 'boolean',
        'published_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the admin (user) who created this announcement
     */
    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }

    /**
     * Scope: Get only published announcements
     */
    public function scopePublished($query)
    {
        return $query->where('published', true);
    }

    /**
     * Scope: Get announcements ordered by latest first
     */
    public function scopeLatest($query)
    {
        return $query->orderBy('published_at', 'desc')->orderBy('created_at', 'desc');
    }

    /**
     * Scope: Get announcements for today and newer
     */
    public function scopeRecent($query, $days = 30)
    {
        return $query->where('published_at', '>=', now()->subDays($days));
    }

    /**
     * Mark announcement as published
     */
    public function publish()
    {
        $this->update([
            'published' => true,
            'published_at' => now(),
        ]);
    }

    /**
     * Mark announcement as unpublished
     */
    public function unpublish()
    {
        $this->update([
            'published' => false,
        ]);
    }
}
