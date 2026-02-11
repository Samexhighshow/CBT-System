<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class AnnouncementController extends Controller
{
    /**
     * Get all published announcements (public endpoint)
     */
    public function index(Request $request)
    {
        try {
            $limit = $request->input('limit', 10);
            $page = $request->input('page', 1);

            $announcements = Announcement::published()
                ->with('admin:id,name')
                ->latest()
                ->paginate($limit, ['*'], 'page', $page);

            return response()->json([
                'success' => true,
                'data' => $announcements->items(),
                'pagination' => [
                    'total' => $announcements->total(),
                    'per_page' => $announcements->perPage(),
                    'current_page' => $announcements->currentPage(),
                    'last_page' => $announcements->lastPage(),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch announcements',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get a specific announcement (public endpoint)
     */
    public function show($id)
    {
        try {
            $announcement = Announcement::where('published', true)
                ->with('admin:id,name')
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $announcement,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Announcement not found',
            ], 404);
        }
    }

    /**
     * Create a new announcement (admin only)
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'content' => 'required|string|min:10',
            'published' => 'boolean',
            'image' => 'nullable|image|max:2048',
            'image_url' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            /** @var User $user */
            $user = Auth::user();

            $imageUrl = null;
            if ($request->hasFile('image')) {
                $path = $request->file('image')->store('announcements', 'public');
                $imageUrl = Storage::url($path);
            } elseif ($request->filled('image_url')) {
                $imageUrl = $request->input('image_url');
            }

            $announcement = Announcement::create([
                'title' => $request->title,
                'content' => $request->content,
                'admin_id' => $user->id,
                'published' => $request->input('published', true),
                'published_at' => $request->input('published', true) ? now() : null,
                'image_url' => $imageUrl,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Announcement created successfully',
                'data' => $announcement->load('admin:id,name'),
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to create announcement',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update an announcement (admin only)
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:255',
            'content' => 'sometimes|string|min:10',
            'published' => 'sometimes|boolean',
            'image' => 'nullable|image|max:2048',
            'image_url' => 'nullable|string',
            'remove_image' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $announcement = Announcement::findOrFail($id);

            // Check if user is the creator or admin
            /** @var User $user */
            $user = Auth::user();
            if ($announcement->admin_id !== $user->id && !$user->hasRole('Main Admin')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to update this announcement',
                ], 403);
            }

            // Handle publish status change
            if ($request->has('published')) {
                if ($request->published && !$announcement->published) {
                    $announcement->publish();
                } elseif (!$request->published && $announcement->published) {
                    $announcement->unpublish();
                }
            }

            // Handle image upload/removal
            $imageUrl = $announcement->image_url;
            if ($request->boolean('remove_image', false)) {
                if ($announcement->image_url && str_starts_with($announcement->image_url, '/storage/')) {
                    $relativePath = str_replace('/storage/', '', $announcement->image_url);
                    Storage::disk('public')->delete($relativePath);
                }
                $imageUrl = null;
            }

            if ($request->hasFile('image')) {
                if ($announcement->image_url && str_starts_with($announcement->image_url, '/storage/')) {
                    $relativePath = str_replace('/storage/', '', $announcement->image_url);
                    Storage::disk('public')->delete($relativePath);
                }
                $path = $request->file('image')->store('announcements', 'public');
                $imageUrl = Storage::url($path);
            } elseif ($request->filled('image_url')) {
                $imageUrl = $request->input('image_url');
            }

            $announcement->update(array_filter([
                'title' => $request->get('title', $announcement->title),
                'content' => $request->get('content', $announcement->content),
                'image_url' => $imageUrl,
            ], function ($value) {
                return $value !== null;
            }));

            return response()->json([
                'success' => true,
                'message' => 'Announcement updated successfully',
                'data' => $announcement->load('admin:id,name'),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update announcement',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete an announcement (admin only)
     */
    public function destroy($id)
    {
        try {
            $announcement = Announcement::findOrFail($id);

            // Check if user is the creator or main admin
            /** @var User $user */
            $user = Auth::user();
            if ($announcement->admin_id !== $user->id && !$user->hasRole('Main Admin')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized to delete this announcement',
                ], 403);
            }

            $announcement->delete();

            return response()->json([
                'success' => true,
                'message' => 'Announcement deleted successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete announcement',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get announcements for admin management (admin only)
     */
    public function adminIndex(Request $request)
    {
        try {
            $limit = $request->input('limit', 15);
            $published = $request->input('published', null);

            $query = Announcement::with('admin:id,name');

            if ($published !== null) {
                $query->where('published', $published);
            }

            $announcements = $query->latest()
                ->paginate($limit);

            return response()->json([
                'success' => true,
                'data' => $announcements->items(),
                'pagination' => [
                    'total' => $announcements->total(),
                    'per_page' => $announcements->perPage(),
                    'current_page' => $announcements->currentPage(),
                    'last_page' => $announcements->lastPage(),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch announcements',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
