"use client";

import type React from "react";

import { useReducer, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Moon, Sun, Send, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

interface ChatState {
  messages: Message[];
  isTyping: boolean;
  darkMode: boolean;
}

type ChatAction =
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "SET_TYPING"; payload: boolean }
  | { type: "TOGGLE_DARK_MODE" }
  | { type: "INIT_DARK_MODE"; payload: boolean };

// Reducer
const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case "ADD_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };
    case "SET_TYPING":
      return {
        ...state,
        isTyping: action.payload,
      };
    case "TOGGLE_DARK_MODE":
      const newDarkMode = !state.darkMode;
      localStorage.setItem("darkMode", JSON.stringify(newDarkMode));
      return {
        ...state,
        darkMode: newDarkMode,
      };
    case "INIT_DARK_MODE":
      return {
        ...state,
        darkMode: action.payload,
      };
    default:
      return state;
  }
};

// Typing indicator component
const TypingIndicator = () => (
  <div className="flex items-start space-x-3">
    <div className="flex-shrink-0">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Bot className="h-4 w-4 text-primary" />
      </div>
    </div>
    <div className="flex items-center space-x-1 p-3">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
      </div>
      <span className="text-sm text-muted-foreground ml-2">
        Bot is thinking...
      </span>
    </div>
  </div>
);

// Message component
const MessageBubble = ({
  message,
  isUser,
}: {
  message: Message;
  isUser: boolean;
}) => (
  <div
    className={cn(
      "flex mb-4 animate-in slide-in-from-bottom-2 fade-in duration-300",
      isUser ? "justify-end" : "justify-start"
    )}
  >
    {!isUser && (
      <div className="flex-shrink-0 mr-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      </div>
    )}

    <div
      className={cn(
        "max-w-[70%] px-4 py-2 rounded-2xl shadow-sm",
        isUser
          ? "bg-primary text-primary-foreground rounded-br-md"
          : "bg-muted text-muted-foreground rounded-bl-md"
      )}
    >
      <p className="text-sm leading-relaxed whitespace-pre-wrap">
        {message.text}
      </p>
      <p className="text-xs opacity-70 mt-1">
        {message.timestamp.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>

    {isUser && (
      <div className="flex-shrink-0 ml-3">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      </div>
    )}
  </div>
);

export default function ChatApp() {
  const [state, dispatch] = useReducer(chatReducer, {
    messages: [],
    isTyping: false,
    darkMode: true,
  });

  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode");
    if (savedDarkMode !== null) {
      dispatch({ type: "INIT_DARK_MODE", payload: JSON.parse(savedDarkMode) });
    }
  }, []);

  useEffect(() => {
    if (state.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [state.darkMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages, state.isTyping]);

  // NEW FUNCTION to call the backend API
  const getBotResponse = async (userMessage: string) => {
    dispatch({ type: "SET_TYPING", payload: true });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();

      dispatch({
        type: "ADD_MESSAGE",
        payload: {
          id: Date.now().toString() + "-bot",
          text: data.response,
          sender: "bot",
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error("Failed to get bot response:", error);
      dispatch({
        type: "ADD_MESSAGE",
        payload: {
          id: Date.now().toString() + "-bot-error",
          text: "Sorry, I'm having trouble connecting. Please try again later.",
          sender: "bot",
          timestamp: new Date(),
        },
      });
    } finally {
      dispatch({ type: "SET_TYPING", payload: false });
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString() + "-user",
      text: inputValue.trim(),
      sender: "user",
      timestamp: new Date(),
    };

    dispatch({ type: "ADD_MESSAGE", payload: userMessage });
    setInputValue("");

    // Call the new function to get a real response
    await getBotResponse(userMessage.text);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      className={cn(
        "min-h-screen transition-colors duration-300 ease-in-out",
        "bg-background text-foreground"
      )}
    >
      <div className="container mx-auto max-w-4xl h-screen flex flex-col p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pt-4">
          <h1 className="text-2xl font-semibold">ChaiCode Lecture Assistant</h1>
          <Button
            variant="outline"
            size="icon"
            onClick={() => dispatch({ type: "TOGGLE_DARK_MODE" })}
            className="transition-all duration-200 hover:scale-105"
          >
            {state.darkMode ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Chat Container */}
        <Card
          className="flex-1 flex flex-col shadow-lg border-0 bg-card dark:border-amber-50"
          style={{ borderWidth: "0.5px" }}
        >
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {state.messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg mb-2">👋 Welcome!</p>
                  <p className="text-sm">
                    Ask me anything about the NodeJS or Python lectures.
                  </p>
                </div>
              </div>
            )}

            {state.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isUser={message.sender === "user"}
              />
            ))}

            {state.isTyping && (
              <div className="flex justify-start animate-in slide-in-from-bottom-2 fade-in duration-300">
                <div className="bg-muted rounded-2xl rounded-bl-md shadow-sm">
                  <TypingIndicator />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t bg-card p-4">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about Node.js, Python..."
                className="flex-1 rounded-full border-input focus:ring-2 focus:ring-ring transition-all duration-200"
                disabled={state.isTyping}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || state.isTyping}
                size="icon"
                className="rounded-full transition-all duration-200 hover:scale-105 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
