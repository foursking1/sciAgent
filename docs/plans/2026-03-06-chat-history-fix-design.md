# Chat History Bug Fix Design

**Date**: 2026-03-06
**Status**: Approved
**Author**: Claude Code

## Problem Summary

Users are experiencing issues with chat history in SciAgent:
1. When navigating away from a session and returning, chat history disappears
2. Only user messages are visible, agent responses are missing

## Root Causes

### 1. Frontend - useEffect Race Condition
**File**: `frontend/components/chat/SessionChat.tsx`

Two separate useEffect hooks trigger on `sessionId` change:
- Lines 218-224: Clears `events` state
- Lines 227-256: Loads historical messages into `events`

This creates a race condition where the clear might happen after the load.

### 2. Backend - AI Message Persistence
**File**: `backend/api/routes/sessions.py`

In the `/chat` endpoint (lines 221-317), AI responses are saved inside the async generator function. The database session lifecycle may not be properly managed, causing messages to not be committed.

### 3. API Type Mismatch
**File**: `frontend/lib/api.ts`

The `Message` interface defines `session_id` as `number`, but the backend sends a `string` (UUID).

## Solution: Scheme A - Minimal Fix

### Fix 1: Frontend useEffect Consolidation
- Remove the separate useEffect that clears events
- Consolidate logic into a single useEffect that:
  1. First clears events
  2. Then loads historical messages

### Fix 2: Backend Database Session Management
- Ensure proper commit/refresh when saving AI messages
- Add error logging for debugging
- Verify database session is active when saving

### Fix 3: Type Definition Correction
- Change `Message.session_id` from `number` to `string` in `api.ts`

## Files to Modify

1. `frontend/components/chat/SessionChat.tsx`
2. `backend/api/routes/sessions.py`
3. `frontend/lib/api.ts`

## Risk Assessment

**Low Risk**: Changes are minimal and localized to specific issues.

## Success Criteria

- [ ] Chat history persists across page navigation
- [ ] Both user and agent messages are visible after refresh
- [ ] No TypeScript type errors
