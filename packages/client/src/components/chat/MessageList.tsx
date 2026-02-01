import { useEffect, useRef } from "react";
import type { ChatMessage } from "@kimi-excel/shared";
import { MessageBubble } from "./MessageBubble.js";

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  useEffect(() => {
    // Only scroll if new messages were added
    if (messages.length > prevMessageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  // Get the last message for aria-live announcements
  const lastMessage = messages[messages.length - 1];
  const hasNewMessage = messages.length > 0 && 
    lastMessage?.role === "assistant" && 
    !lastMessage?.isStreaming;

  return (
    <div 
      ref={containerRef}
      className="message-list"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      aria-atomic="false"
    >
      {/* Screen reader announcement for new messages */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {hasNewMessage ? `New message from assistant: ${lastMessage.content.slice(0, 100)}${lastMessage.content.length > 100 ? "..." : ""}` : ""}
        {lastMessage?.isStreaming ? "Assistant is typing..." : ""}
      </div>

      {messages.map((message, index) => (
        <MessageBubble 
          key={message.id} 
          message={message}
          isLast={index === messages.length - 1}
        />
      ))}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
