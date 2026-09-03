// Comments list + reply tree + guest name input + polling

"use client";

import { useState, useEffect, useCallback } from "react";

interface Comment {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  replies: Comment[];
}

interface CommentsPanelProps {
  documentId: string;
  shareToken?: string;
  isOwner: boolean;
  sessionUserName?: string;
}

export default function CommentsPanel({
  documentId,
  shareToken,
  isOwner,
  sessionUserName,
}: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [guestName, setGuestName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const fetchComments = useCallback(async () => {
    try {
      const params = new URLSearchParams({ documentId });
      if (shareToken) params.set("token", shareToken);
      const res = await fetch(`/api/comments?${params}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch {
      console.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [documentId, shareToken]);

  useEffect(() => {
    fetchComments();
    const interval = setInterval(fetchComments, 10000);
    return () => clearInterval(interval);
  }, [fetchComments]);

  const submitComment = async (body: string, parentCommentId?: string) => {
    if (!body.trim()) return;
    if (!isOwner && !guestName.trim()) {
      alert("Please enter your name to comment");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          body: body.trim(),
          authorName: isOwner ? sessionUserName : guestName,
          shareToken,
          parentCommentId,
        }),
      });

      if (res.ok) {
        setNewComment("");
        setReplyText("");
        setReplyingTo(null);
        await fetchComments();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const CommentItem = ({ comment, depth = 0 }: { comment: Comment; depth?: number }) => (
    <div className={`${depth > 0 ? "ml-6 pl-4" : ""}`}
      style={depth > 0 ? { borderLeft: "2.5px solid var(--cream-darker)" } : {}}>
      <div className="py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: "var(--orange)", color: "#fff", border: "2px solid var(--orange-dark)" }}>
            {comment.authorName[0]?.toUpperCase()}
          </div>
          <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{comment.authorName}</span>
          <span className="text-xs" style={{ color: "var(--ink-muted)" }}>{formatTime(comment.createdAt)}</span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>{comment.body}</p>
        {depth === 0 && (
          <button
            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
            className="text-xs mt-1.5 font-semibold transition-colors"
            style={{ color: "var(--orange)" }}
          >
            Reply
          </button>
        )}
      </div>

      {replyingTo === comment.id && (
        <div className="mb-3 space-y-2">
          {!isOwner && !guestName && (
            <input
              className="input text-sm py-1.5"
              placeholder="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
          )}
          <textarea
            className="input text-sm py-1.5 resize-none"
            rows={2}
            placeholder="Write a reply…"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => submitComment(replyText, comment.id)}
              disabled={submitting}
              className="btn-primary text-xs py-1 px-3"
            >
              Reply
            </button>
            <button
              onClick={() => { setReplyingTo(null); setReplyText(""); }}
              className="btn-secondary text-xs py-1 px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {comment.replies?.map((reply) => (
        <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full" style={{ background: "#fff" }}>
      <div className="flex-1 overflow-y-auto px-4 py-3"
        style={{ borderBottom: "none", gap: 0 }}>
        {loading ? (
          <div className="space-y-3 pt-2">
            {[1, 2].map((i) => <div key={i} className="h-16 shimmer rounded-xl"
              style={{ border: "1.5px solid var(--cream-darker)" }} />)}
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-10">
            <svg className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--cream-darker)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>No comments yet. Be the first!</p>
          </div>
        ) : (
          <div style={{ borderTop: "none" }}>
            {comments.map((c, i) => (
              <div key={c.id} style={i > 0 ? { borderTop: "2px solid var(--cream-dark)" } : {}}>
                <CommentItem comment={c} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comment input */}
      <div className="px-4 py-3 space-y-2 flex-shrink-0"
        style={{ borderTop: "2px solid var(--cream-darker)" }}>
        {!isOwner && (
          <input
            className="input text-sm py-1.5"
            placeholder="Your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
          />
        )}
        <textarea
          className="input text-sm py-2 resize-none"
          rows={3}
          placeholder="Add a comment…"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              submitComment(newComment);
            }
          }}
        />
        <button
          onClick={() => submitComment(newComment)}
          disabled={submitting || !newComment.trim()}
          className="btn-primary text-sm w-full py-2"
        >
          {submitting ? "Posting…" : "Post comment"}
        </button>
        <p className="text-xs text-center" style={{ color: "var(--ink-muted)" }}>⌘↵ to post</p>
      </div>
    </div>
  );
}
