

## Infinite Scroll, Scroll-to-Bottom Button with Unread Counter, and Unread Separator

### Overview

This plan adds Telegram-style scrolling behavior to the chat:
1. **Infinite scroll** -- messages load in pages (oldest first), more pages load as user scrolls up
2. **Scroll-to-bottom button** with unread counter -- appears in the bottom-right corner above the input; clicking it scrolls to bottom and marks all as read
3. **Unread messages separator** -- a visual divider ("Unread messages") shown between the last read message and the first unread message when entering a chat
4. **Read-on-scroll** -- messages are marked as read as the user scrolls them into view using IntersectionObserver

### Technical Details

#### 1. `src/hooks/useMessages.ts` -- Paginated fetching

- Replace the single `useQuery` that loads ALL messages with `useInfiniteQuery` from `@tanstack/react-query`
- Each page fetches `PAGE_SIZE` (e.g. 30) messages ordered by `created_at DESC` with `.range(offset, offset + PAGE_SIZE - 1)`
- The hook returns `{ data, fetchNextPage, hasNextPage, isFetchingNextPage }` (pages are reversed so oldest-first display works)
- The enrichment loop (profiles, reply_to, reads) stays but operates per-page
- Realtime subscription stays the same -- it invalidates the query on changes
- Add a new exported function/hook `useUnreadMessageIds(conversationId)` that returns the set of unread message IDs for the current user (lightweight query of `message_reads` vs all messages from others)

#### 2. `src/components/chat/ChatWindow.tsx` -- Main changes

**Replace `ScrollArea` with a native scrollable `div`** (needed for reliable `scrollTop` / `IntersectionObserver` access -- Radix `ScrollArea` wraps content in a Viewport that complicates imperative scroll control):

```text
<div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-2">
  {/* sentinel for loading older messages */}
  {hasNextPage && <div ref={topSentinelRef} className="h-1" />}
  {isFetchingNextPage && <Spinner />}
  {/* messages */}
  ...
</div>
```

**Infinite scroll (load older messages on scroll up):**
- Place an invisible sentinel `div` at the top of the messages list
- Use `IntersectionObserver` on the sentinel; when it becomes visible, call `fetchNextPage()`
- After loading, preserve scroll position so the view doesn't jump

**Scroll-to-bottom button + unread badge:**
- Track `isAtBottom` state by listening to the `scroll` event on the container
- When `isAtBottom` is false, show a circular button with `ArrowDown` icon positioned `absolute bottom-4 right-4` inside a `relative` wrapper around the messages area (above the input bar)
- Next to / on top of the button, show an unread count badge (count of messages from others not in `read_by` for the current user)
- On click: `scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' })` and call `markAsRead` for all unread messages

**Unread messages separator:**
- Compute `firstUnreadId` -- the ID of the earliest message from another user that is not in `read_by`
- Render a separator before that message:
  ```text
  <div className="my-3 flex justify-center">
    <span className="rounded-full bg-primary/20 px-3 py-1 text-xs text-primary font-medium">
      Unread messages
    </span>
  </div>
  ```
- On initial chat load, scroll to the unread separator instead of the very bottom, so the user sees context above the unread messages

**Read-on-scroll (IntersectionObserver):**
- For each message bubble from another user that is not yet read, attach an `IntersectionObserver`
- When a message enters the viewport for > 300ms, add it to a batch of IDs to mark as read
- Debounce the `markAsRead` mutation call (e.g. 500ms) to batch multiple reads into one request
- As messages are marked read, the unread counter on the scroll-to-bottom button updates

#### 3. Files to modify

| File | Changes |
|------|---------|
| `src/hooks/useMessages.ts` | Switch from `useQuery` to `useInfiniteQuery`; add pagination params; keep enrichment per page |
| `src/components/chat/ChatWindow.tsx` | Replace `ScrollArea` with native div; add top sentinel + IntersectionObserver for infinite scroll; add bottom-right scroll button with unread badge; add unread separator; add per-message IntersectionObserver for read-on-scroll; remove old "mark all as read on mount" effect |

#### 4. All UI text and code comments will be in English

- Button tooltip: none needed (icon only)
- Separator text: "Unread messages"
- All code comments in English
