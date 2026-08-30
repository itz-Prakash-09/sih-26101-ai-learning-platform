import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, XCircle, TrendingUp, BookOpen, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import "./App.css";

const STAGES = [
  { id: "upload", label: "Material", num: "01" },
  { id: "quiz", label: "Assessment", num: "02" },
  { id: "gaps", label: "Ledger", num: "03" },
  { id: "recs", label: "Pathways", num: "04" },
];

const MOCK_CATALOG = [
  { topic: "sampling", title: "Foundations of Sample Survey Design", hours: 6, provider: "NSSO Academy" },
  { topic: "estimation", title: "Estimator Theory and Bias Correction", hours: 4, provider: "iGOT Karmayogi" },
  { topic: "data quality", title: "Data Validation & Quality Assurance in Official Statistics", hours: 5, provider: "MoSPI Training Wing" },
  { topic: "visualization", title: "Statistical Dissemination & Dashboarding", hours: 3, provider: "iGOT Karmayogi" },
  { topic: "index numbers", title: "Constructing Price and Volume Indices", hours: 5, provider: "NSSO Academy" },
  { topic: "national accounts", title: "System of National Accounts: Core Concepts", hours: 8, provider: "MoSPI Training Wing" },
  { topic: "general", title: "Statistical Literacy for Public Administration", hours: 3, provider: "iGOT Karmayogi" },
];

function findCourses(topic) {
  const t = topic.toLowerCase();
  const direct = MOCK_CATALOG.filter((c) => t.includes(c.topic) || c.topic.includes(t.split(" ")[0]));
  return direct.length ? direct.slice(0, 2) : [MOCK_CATALOG[MOCK_CATALOG.length - 1]];
}

// Swap this out for your own backend endpoint in production —
// calling api.anthropic.com directly from client code is fine for a hackathon
// prototype but should be proxied through a server for a real deployment.
async function callClaude(prompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) throw new Error("Request failed");
  const data = await response.json();
  const text = data.content.map((b) => b.text || "").join("\n");
  return text.replace(/```json|```/g, "").trim();
}

export default function App() {
  const [stage, setStage] = useState("upload");
  const [material, setMaterial] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef(null);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setMaterial(String(reader.result || "").slice(0, 12000));
    reader.readAsText(f);
  }

  async function generateQuiz() {
    if (!material.trim()) {
      setError("Add training material before generating an assessment.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const prompt = `You are building a competency assessment for officials in India's Official Statistical System.
Read the following training material and generate exactly 6 multiple choice questions that test understanding of it.
Tag each question with a short topic label (2-3 words, lowercase, e.g. "sampling", "estimation", "data quality").
Return ONLY valid JSON, no preamble, no markdown fences, in this exact shape:
{"questions":[{"topic":"string","question":"string","options":["string","string","string","string"],"correct":0}]}
The "correct" field is the zero-based index of the correct option.

Material:
"""${material}"""`;
      const raw = await callClaude(prompt);
      const parsed = JSON.parse(raw);
      if (!parsed.questions || !parsed.questions.length) throw new Error("empty");
      setQuestions(parsed.questions);
      setAnswers({});
      setSubmitted(false);
      setStage("quiz");
    } catch (e) {
      setError("Couldn't generate an assessment from that material. Try adding more text, then retry.");
    } finally {
      setLoading(false);
    }
  }

  function selectAnswer(qIdx, optIdx) {
    if (submitted) return;
    setAnswers((a) => ({ ...a, [qIdx]: optIdx }));
  }

  function submitQuiz() {
    if (Object.keys(answers).length < questions.length) {
      setError("Answer every question before submitting.");
      return;
    }
    setError("");
    setSubmitted(true);
    setStage("gaps");
  }

  const topicScores = {};
  questions.forEach((q, i) => {
    const t = q.topic || "general";
    if (!topicScores[t]) topicScores[t] = { correct: 0, total: 0 };
    topicScores[t].total += 1;
    if (answers[i] === q.correct) topicScores[t].correct += 1;
  });
  const topicList = Object.entries(topicScores).map(([topic, v]) => ({
    topic,
    pct: Math.round((v.correct / v.total) * 100),
    correct: v.correct,
    total: v.total,
  }));
  const gaps = topicList.filter((t) => t.pct < 60);
  const overallPct = questions.length
    ? Math.round((Object.values(topicScores).reduce((s, v) => s + v.correct, 0) / questions.length) * 100)
    : 0;

  const wordCount = material.trim() ? material.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div>
            <div className="header-eyebrow">PS 26101 · Prototype</div>
            <div className="header-title">Karmayogi Capability Bridge</div>
          </div>
          <div className="header-meta">
            Official Statistical System
            <br />
            Capacity building module
          </div>
        </div>
      </header>

      <nav className="nav">
        <div className="nav-inner">
          {STAGES.map((s, i) => {
            const active = stage === s.id;
            const reachable =
              s.id === "upload" ||
              (s.id === "quiz" && questions.length > 0) ||
              (s.id === "gaps" && submitted) ||
              (s.id === "recs" && submitted);
            return (
              <button
                key={s.id}
                onClick={() => reachable && setStage(s.id)}
                className={`nav-tab ${active ? "active" : ""} ${!reachable ? "disabled" : ""}`}
              >
                <span className="nav-tab-num">{s.num}</span>
                {s.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="main">
        {error && (
          <div className="error-banner">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {stage === "upload" && (
          <section>
            <h1 className="section-title">Submit training material</h1>
            <p className="section-subtitle">
              Upload a document or paste text from a course module. The engine reads it once and drafts a
              six-question competency check tagged by topic.
            </p>

            <div className="upload-box" onClick={() => fileInputRef.current?.click()}>
              <Upload size={20} color="#8A7B5C" />
              <div>
                <div className="upload-box-title">{fileName || "Choose a text file"}</div>
                <div className="upload-box-hint">.txt, .md — or paste directly below</div>
              </div>
              <input ref={fileInputRef} type="file" accept=".txt,.md" onChange={handleFile} style={{ display: "none" }} />
            </div>

            <textarea
              className="material-textarea"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="Paste training content here — e.g. a chapter on sample survey design, estimation methods, or data quality protocols..."
            />

            <div className="upload-footer">
              <span className="word-count">{wordCount} words loaded</span>
              <button className="btn btn-primary" onClick={generateQuiz} disabled={loading}>
                {loading ? <Loader2 size={16} className="spin" /> : <FileText size={16} />}
                {loading ? "Drafting assessment..." : "Generate assessment"}
                {!loading && <ChevronRight size={16} />}
              </button>
            </div>
          </section>
        )}

        {stage === "quiz" && questions.length > 0 && (
          <section>
            <h1 className="section-title">Competency check</h1>
            <p className="section-subtitle">{questions.length} questions, tagged by topic. Answers lock once submitted.</p>

            {questions.map((q, qi) => (
              <div className="question-card" key={qi}>
                <div className="question-head">
                  <span className="question-topic">{q.topic || "general"}</span>
                  <span className="question-index">Q{qi + 1}</span>
                </div>
                <div className="question-text">{q.question}</div>
                <div className="options">
                  {q.options.map((opt, oi) => {
                    const picked = answers[qi] === oi;
                    const isCorrect = oi === q.correct;
                    let cls = "option";
                    if (submitted && isCorrect) cls += " correct";
                    else if (submitted && picked && !isCorrect) cls += " incorrect";
                    else if (picked) cls += " picked";
                    if (submitted) cls += " locked";
                    return (
                      <button key={oi} className={cls} onClick={() => selectAnswer(qi, oi)}>
                        {opt}
                        {submitted && isCorrect && <CheckCircle2 size={16} />}
                        {submitted && picked && !isCorrect && <XCircle size={16} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {!submitted && (
              <button className="btn btn-primary" onClick={submitQuiz}>
                Submit assessment
              </button>
            )}
            {submitted && (
              <button className="btn btn-accent" onClick={() => setStage("gaps")}>
                View competency ledger <ChevronRight size={16} />
              </button>
            )}
          </section>
        )}

        {stage === "gaps" && (
          <section>
            <h1 className="section-title">Competency ledger</h1>
            <p className="section-subtitle">Per-topic performance from the assessment. Anything under 60% is flagged as a gap.</p>

            <div className="summary-bar">
              <div>
                <div className="summary-label">Overall score</div>
                <div className="summary-value">{overallPct}%</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="summary-label">Gaps flagged</div>
                <div className="summary-value accent">{gaps.length}</div>
              </div>
            </div>

            <div className="ledger">
              {topicList.map((t) => (
                <div className="ledger-row" key={t.topic}>
                  <div className="ledger-topic">{t.topic}</div>
                  <div className="ledger-track">
                    <div className={`ledger-fill ${t.pct < 60 ? "gap" : "clear"}`} style={{ width: `${t.pct}%` }} />
                  </div>
                  <div className="ledger-score">
                    {t.correct}/{t.total} · {t.pct}%
                  </div>
                  <span className={`ledger-flag ${t.pct < 60 ? "gap" : "clear"}`}>{t.pct < 60 ? "GAP" : "CLEAR"}</span>
                </div>
              ))}
            </div>

            <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => setStage("recs")}>
              View recommended pathways <ChevronRight size={16} />
            </button>
          </section>
        )}

        {stage === "recs" && (
          <section>
            <h1 className="section-title">Recommended pathways</h1>
            <p className="section-subtitle" style={{ maxWidth: 600 }}>
              Matched against flagged gaps. In production this queries the iGOT Karmayogi course catalog directly —
              here it draws from a representative sample set for demonstration.
            </p>

            {gaps.length === 0 && (
              <div className="no-gaps">
                No gaps flagged. All tested topics are above the 60% threshold — no additional training required at this time.
              </div>
            )}

            {gaps.map((g) => (
              <div className="gap-group" key={g.topic}>
                <div className="gap-group-head">
                  <TrendingUp size={16} color="#D85A30" />
                  <span className="gap-group-topic">{g.topic}</span>
                  <span className="gap-group-pct">{g.pct}% scored</span>
                </div>
                <div className="course-list">
                  {findCourses(g.topic).map((c) => (
                    <div className="course-card" key={c.title}>
                      <BookOpen size={18} color="#C68B2C" />
                      <div className="course-info">
                        <div className="course-title">{c.title}</div>
                        <div className="course-meta">
                          {c.provider} · {c.hours}h module
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}