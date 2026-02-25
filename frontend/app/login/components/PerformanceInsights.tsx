"use client";

import React from "react";

type Topic = {
  name: string;
  mastery: number; // 0–100
  attempts: number;
  trend: "Improving" | "Declining" | "Flat";
};

const mockTopics: Topic[] = [
  { name: "Addressing Modes", mastery: 42, attempts: 18, trend: "Declining" },
  { name: "Stack & Calling Convention", mastery: 50, attempts: 9, trend: "Flat" },
  { name: "Branching & Flags", mastery: 58, attempts: 14, trend: "Improving" },
  { name: "Binary/Hex Conversion", mastery: 78, attempts: 6, trend: "Improving" },
];

export default function PerformanceInsights() {
  const weakest = [...mockTopics].sort((a, b) => a.mastery - b.mastery).slice(0, 3);
  const nextFocus = weakest[0];

  return (
    <div className="mt-6 bg-white border border-gray-200 rounded-lg shadow-sm p-6">
      <h3 className="text-xl font-semibold text-black">
        Performance Insights
      </h3>

      <p className="text-sm text-gray-600 mt-1">
        Data-driven summary of your weakest areas and recommended next focus.
      </p>

      {/* Weakest Topics */}
      <div className="mt-6">
        <h4 className="font-semibold text-black mb-3">Weakest Topics</h4>

        <div className="space-y-3">
          {weakest.map((topic, i) => (
            <div
              key={i}
              className="flex justify-between items-center p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <div>
                <div className="font-medium text-black">{topic.name}</div>
                <div className="text-xs text-gray-600">
                  Attempts: {topic.attempts} • Trend: {topic.trend}
                </div>
              </div>
              <div className="font-semibold text-red-600">
                {topic.mastery}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendation */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-semibold text-black mb-2">
          Recommended Next Focus
        </h4>
        <p className="text-sm text-gray-700">
          Focus on <span className="font-semibold">{nextFocus.name}</span>. 
          Improving this topic will increase your overall mastery the fastest.
        </p>
      </div>
    </div>
  );
}