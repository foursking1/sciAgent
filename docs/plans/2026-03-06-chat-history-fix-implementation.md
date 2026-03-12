# Chat History Bug Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the chat history persistence issue where agent messages disappear and only user messages are visible.

**Architecture:** Minimal fix approach addressing three key issues: frontend useEffect race condition, backend database persistence, and API type mismatch.

**Tech Stack:** Next.js 14, TypeScript, FastAPI 0.115, SQLAlchemy 2.0

---

## Task 1: Fix Frontend useEffect Race Condition

**Files:**
- Modify: `frontend/components/chat/SessionChat.tsx:217-256`

**Step 1: Read the current file**

Read the full file to understand the current implementation.

**Step 2: Remove the separate events-clearing useEffect**

Remove lines 217-224 (the useEffect that only clears events):

```tsx
  // Reset state when sessionId changes
  useEffect(() => {
    setEvents([])
    setMessage('')
    setIsSending(false)
    setIsConnected(false)
    setConnectionError(null)
  }, [sessionId])
```

**Step 3: Consolidate logic into the historical messages useEffect**

Modify the loadMessages useEffect (lines 226-256) to clear state first before loading:

```tsx
  // Load historical messages when session changes
  useEffect(() => {
    if (!token || !sessionId) return

    const loadMessages = async () => {
      try {
        // Reset state first
        setEvents([])
        setMessage('')
        setIsSending(false)
        setIsConnected(false)
        setConnectionError(null)

        // Load historical messages
        const messages = await sessionsApi.getMessages(token, sessionId)
        // Convert messages to StreamEvent format
        const historicalEvents: StreamEvent[] = messages.map(msg => {
          if (msg.role === 'user') {
            return {
              type: 'user_message',
              content: msg.content,
              timestamp: msg.created_at,
            } as StreamEvent
          } else {
            return {
              type: 'message',
              content: msg.content,
              timestamp: msg.created_at,
            } as StreamEvent
          }
        })
        setEvents(historicalEvents)
      } catch (err) {
        console.error('Error loading messages:', err)
      }
    }

    loadMessages()
  }, [sessionId, token])
```

**Step 4: Verify the changes**

Check that:
- Only one useEffect handles sessionId changes
- State is cleared before loading messages
- No TypeScript errors

**Step 5: Commit**

```bash
git add frontend/components/chat/SessionChat.tsx
git commit -m "fix: consolidate useEffect to prevent race condition in chat history"
```

---

## Task 2: Fix API Type Mismatch

**Files:**
- Modify: `frontend/lib/api.ts:23-29`

**Step 1: Read the current file**

Read `frontend/lib/api.ts` to see the current Message interface.

**Step 2: Fix the session_id type**

Change line 25 from:
```typescript
  session_id: number;
```

To:
```typescript
  session_id: string;
```

**Step 3: Verify no TypeScript errors**

Check that the type change doesn't break anything else in the file.

**Step 4: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "fix: correct Message.session_id type from number to string"
```

---

## Task 3: Fix Backend AI Message Persistence

**Files:**
- Modify: `backend/api/routes/sessions.py:295-303`

**Step 1: Read the current file**

Read `backend/api/routes/sessions.py` to understand the chat endpoint.

**Step 2: Ensure proper database session handling**

The issue is in the `/chat` endpoint's event_generator, lines 295-303. We need to ensure the message is properly committed.

Current code:
```python
            # Save AI response to database
            if ai_response_parts:
                full_response = '\n'.join(ai_response_parts)
                await session_manager.add_message(
                    session_id=session_id,
                    content=full_response,
                    role=MessageRole.ASSISTANT,
                    db=db,
                )
```

Verify that `session_manager.add_message()` properly handles the database commit (it should, based on our reading - it calls `await db.commit()` and `await db.refresh(message)`).

**Step 3: Add logging for debugging**

Add logging before and after saving the AI message:

```python
            # Save AI response to database
            if ai_response_parts:
                full_response = '\n'.join(ai_response_parts)
                logger.info(f"Saving AI response to database, length={len(full_response)}")
                try:
                    ai_message = await session_manager.add_message(
                        session_id=session_id,
                        content=full_response,
                        role=MessageRole.ASSISTANT,
                        db=db,
                    )
                    logger.info(f"AI message saved successfully, id={ai_message.id}")
                except Exception as e:
                    logger.error(f"Failed to save AI message: {e}")
                    raise
```

**Step 4: Verify imports**

Make sure `logger` is imported at the top of the file. It should already have:
```python
import logging
logger = logging.getLogger(__name__)
```

**Step 5: Commit**

```bash
git add backend/api/routes/sessions.py
git commit -m "fix: add logging for AI message persistence"
```

---

## Task 4: Verification Test

**Files:**
- None - manual testing

**Step 1: Start the services**

```bash
docker-compose up -d
```

**Step 2: Test the flow**

1. Open frontend at http://localhost:3000
2. Log in or create an account
3. Create a new session
4. Send a message to the agent
5. Wait for the agent to respond
6. Refresh the page or navigate away and come back
7. Verify both user and agent messages are visible

**Step 3: Check backend logs**

```bash
docker-compose logs -f backend
```

Verify you see:
- "Saving AI response to database"
- "AI message saved successfully"

---

## Summary

All tasks completed. The chat history should now persist correctly across page refreshes.
