"use client";

import { useEffect, useState, useCallback } from "react";
import {
  MessageSquare,
  Send,
  Trash2,
  CheckCircle2,
  Plus,
  ClipboardCheck,
  HelpCircle,
} from "lucide-react";

type Question = {
  id: string;
  request_id: string;
  asked_by_user_id: string | null;
  asked_by_name: string | null;
  question: string;
  answer: string | null;
  sent_at: string | null;
  answered_at: string | null;
  created_at: string;
};

type QuestionsProps = {
  requestId: string;
  requestStatus: string;
  isReviewer: boolean;
  isRequester: boolean;
  onStatusChange: (newStatus: string) => void;
};

export default function QuestionsPanel({
  requestId,
  requestStatus,
  isReviewer,
  isRequester,
  onStatusChange,
}: QuestionsProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [submittingAnswer, setSubmittingAnswer] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests/${requestId}/questions`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data);
      }
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const addQuestion = async () => {
    const trimmed = newQuestion.trim();
    if (!trimmed) return;

    const res = await fetch(`/api/requests/${requestId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: trimmed }),
    });

    if (res.ok) {
      setNewQuestion("");
      fetchQuestions();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to add question");
    }
  };

  const deleteQuestion = async (questionId: string) => {
    const res = await fetch(`/api/requests/${requestId}/questions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId }),
    });

    if (res.ok) {
      fetchQuestions();
    }
  };

  const sendQuestions = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/questions/send`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        onStatusChange(data.status);
        fetchQuestions();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to send questions");
      }
    } finally {
      setSending(false);
    }
  };

  const submitAnswer = async (questionId: string) => {
    const answer = answers[questionId]?.trim();
    if (!answer) return;

    setSubmittingAnswer(questionId);
    try {
      const res = await fetch(
        `/api/requests/${requestId}/questions/${questionId}/answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.status) onStatusChange(data.status);
        setAnswers((prev) => {
          const next = { ...prev };
          delete next[questionId];
          return next;
        });
        fetchQuestions();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to submit answer");
      }
    } finally {
      setSubmittingAnswer(null);
    }
  };

  const completeReview = async () => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/review-complete`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        onStatusChange(data.status);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to complete review");
      }
    } finally {
      setCompleting(false);
    }
  };

  // Categorize questions
  const draftQuestions = questions.filter((q) => !q.sent_at);
  const sentQuestions = questions.filter((q) => q.sent_at);
  const allSentAnswered =
    sentQuestions.length > 0 &&
    sentQuestions.every((q) => q.answered_at !== null);

  const canAddQuestions =
    isReviewer &&
    ["Business Approved", "IS Review"].includes(requestStatus);
  const canSendQuestions =
    isReviewer &&
    draftQuestions.length > 0 &&
    ["Business Approved", "IS Review"].includes(requestStatus);
  const canCompleteReview =
    isReviewer &&
    ["Business Approved", "IS Review"].includes(requestStatus) &&
    (sentQuestions.length === 0 || allSentAnswered);
  const canAnswer = isRequester && requestStatus === "Q&A Sent";

  // Don't show panel if no questions and user can't add any
  if (
    questions.length === 0 &&
    !canAddQuestions &&
    !["IS Review", "Q&A Sent", "Epic Planning", "In Progress", "Complete"].includes(requestStatus)
  ) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mt-4">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          Loading Q&A...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mt-4">
      {/* Header */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle size={16} className="text-yellow-600" />
          <h3 className="text-sm font-semibold text-gray-700">
            Review Q&A
          </h3>
          {questions.length > 0 && (
            <span className="text-xs text-gray-400">
              ({questions.length}{" "}
              {questions.length === 1 ? "question" : "questions"})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canCompleteReview && (
            <button
              onClick={completeReview}
              disabled={completing}
              className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <ClipboardCheck size={12} />
              {completing ? "Completing..." : "Mark Review Complete"}
            </button>
          )}
          {canSendQuestions && (
            <button
              onClick={sendQuestions}
              disabled={sending}
              className="flex items-center gap-1.5 text-xs bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <Send size={12} />
              {sending
                ? "Sending..."
                : `Send ${draftQuestions.length} to Requester`}
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {/* Sent questions (with or without answers) */}
        {sentQuestions.map((q) => (
          <div key={q.id} className="px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MessageSquare size={12} className="text-yellow-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 font-medium">
                  {q.question}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Asked by {q.asked_by_name || "Reviewer"}
                  {q.sent_at &&
                    ` · Sent ${new Date(q.sent_at).toLocaleDateString()}`}
                </p>

                {q.answer ? (
                  <div className="mt-3 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle2
                        size={12}
                        className="text-green-600"
                      />
                      <span className="text-xs font-medium text-green-700">
                        Answer
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {q.answer}
                    </p>
                  </div>
                ) : canAnswer ? (
                  <div className="mt-3">
                    <textarea
                      value={answers[q.id] || ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                      placeholder="Type your answer..."
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none bg-gray-50"
                    />
                    <button
                      onClick={() => submitAnswer(q.id)}
                      disabled={
                        !answers[q.id]?.trim() ||
                        submittingAnswer === q.id
                      }
                      className="mt-2 flex items-center gap-1.5 text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      <Send size={11} />
                      {submittingAnswer === q.id
                        ? "Submitting..."
                        : "Submit Answer"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <span className="text-xs text-orange-500 font-medium">
                      Awaiting answer
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Draft questions (only visible to IS Reviewer) */}
        {isReviewer && draftQuestions.length > 0 && (
          <>
            {sentQuestions.length > 0 && (
              <div className="px-5 py-2 bg-gray-50">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Draft Questions (not yet sent)
                </span>
              </div>
            )}
            {draftQuestions.map((q) => (
              <div
                key={q.id}
                className="px-5 py-3 bg-yellow-50/50 flex items-start gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MessageSquare size={12} className="text-yellow-500" />
                </div>
                <p className="text-sm text-gray-700 flex-1">{q.question}</p>
                <button
                  onClick={() => deleteQuestion(q.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                  title="Remove draft question"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </>
        )}

        {/* Empty state */}
        {questions.length === 0 && (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-400">
              No questions yet.
              {canAddQuestions &&
                " Add questions below to send to the business requester."}
            </p>
          </div>
        )}
      </div>

      {/* Add question input — IS Reviewer only, during review */}
      {canAddQuestions && (
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <div className="flex items-end gap-2">
            <textarea
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Type a clarifying question..."
              rows={2}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none bg-white"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addQuestion();
                }
              }}
            />
            <button
              onClick={addQuestion}
              disabled={!newQuestion.trim()}
              className="flex-shrink-0 w-9 h-9 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              title="Add question"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
