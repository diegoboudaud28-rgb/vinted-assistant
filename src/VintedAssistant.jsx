import { useState, useRef } from "react";

const TEAL = "#00C4A0";
const DARK = "#0D1117";
const CARD = "#161B22";
const BORDER = "#30363D";
const TEXT = "#E6EDF3";
const MUTED = "#8B949E";

const SYSTEM_DESCRIPTION = `Tu es un expert en vente sur Vinted. 
Quand on te donne une description d'un vêtement (couleur, marque, état, type), tu génères :
1. Un titre accrocheur (max 60 caractères)
2. Une description vendeuse (3-4 phrases, émojis inclus)
3. Un prix suggéré en euros
4. Des hashtags de référencement Vinted (10-15 hashtags pertinents : marque, type de vêtement, style, couleur, taille, saison, genre). Format : #mot sans espace entre eux, séparés par des espaces.

Réponds UNIQUEMENT en JSON valide sans backticks, sans markdown, exactement ce format :
{"titre": "...", "description": "...", "prix": "...", "hashtags": "..."}`;

const SYSTEM_MESSAGE = `Tu es un assistant vendeur Vinted. 
Un acheteur t'envoie un message. Tu rédiges une réponse courte, sympathique et professionnelle en français.
Réponds UNIQUEMENT avec le texte du message, rien d'autre.`;

const MESSAGE_TEMPLATES = [
  { label: "Négociation prix", text: "Bonjour ! Je suis intéressé(e) mais pourriez-vous baisser un peu le prix ?" },
  { label: "Question taille", text: "Bonjour, quelle est la taille exacte ? Je fais du M normalement." },
  { label: "Délai livraison", text: "Bonjour, combien de temps pour la livraison ?" },
  { label: "Réservation", text: "Bonjour, est-ce que je peux réserver l'article ?" },
  { label: "État article", text: "Bonjour, est-ce que l'article est vraiment en bon état ?" },
];

async function callClaude(systemPrompt, userMessage) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const data = await response.json();
  return data.content?.map(i => i.text || "").join("") || "";
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, fontSize: 14 }}>
      <div style={{
        width: 16, height: 16, border: `2px solid ${BORDER}`,
        borderTop: `2px solid ${TEAL}`, borderRadius: "50%",
        animation: "spin 0.8s linear infinite"
      }} />
      IA en train de générer...
    </div>
  );
}

function Tab({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 20px", border: "none", cursor: "pointer",
      background: active ? TEAL : "transparent",
      color: active ? DARK : MUTED,
      fontWeight: active ? 700 : 400,
      borderRadius: 8, fontSize: 14,
      transition: "all 0.2s",
      fontFamily: "inherit"
    }}>
      {label}
    </button>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} style={{
      padding: "4px 12px", border: `1px solid ${BORDER}`,
      borderRadius: 6, background: copied ? TEAL : "transparent",
      color: copied ? DARK : MUTED, cursor: "pointer",
      fontSize: 12, fontFamily: "inherit", transition: "all 0.2s"
    }}>
      {copied ? "✓ Copié" : "Copier"}
    </button>
  );
}

// ── TAB 1 : Générer annonce ──────────────────────────────────────────────────
function GenerateTab() {
  const [image, setImage] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImage(url);
    const reader = new FileReader();
    reader.onload = () => setImageBase64(reader.result.split(",")[1]);
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    if (!description.trim()) { setError("Décris le vêtement d'abord."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const userMsg = imageBase64
        ? [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
            { type: "text", text: `Génère une annonce Vinted pour ce vêtement. Infos supplémentaires : ${description}` }
          ]
        : `Génère une annonce Vinted pour ce vêtement : ${description}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_DESCRIPTION,
          messages: [{ role: "user", content: userMsg }],
        }),
      });
      const data = await response.json();
      const text = data.content?.map(i => i.text || "").join("") || "";
      const clean = text.replace(/```json|```/g, "").trim();
      setResult(JSON.parse(clean));
    } catch (e) {
      setError("Erreur lors de la génération. Réessaie.");
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Upload photo */}
      <div>
        <label style={{ color: MUTED, fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
          Photo (optionnel)
        </label>
        <div
          onClick={() => fileRef.current.click()}
          style={{
            marginTop: 8, border: `2px dashed ${BORDER}`, borderRadius: 12,
            height: image ? "auto" : 120, display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", overflow: "hidden",
            transition: "border-color 0.2s",
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = TEAL}
          onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
        >
          {image
            ? <img src={image} alt="vêtement" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10 }} />
            : <span style={{ color: MUTED, fontSize: 14 }}>📷 Ajouter une photo</span>
          }
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImage} />
      </div>

      {/* Description */}
      <div>
        <label style={{ color: MUTED, fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
          Décris le vêtement *
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Ex: Jean slim bleu Zara, taille 38, très bon état, porté 2-3 fois..."
          rows={3}
          style={{
            marginTop: 8, width: "100%", background: DARK, border: `1px solid ${BORDER}`,
            borderRadius: 10, padding: "12px 14px", color: TEXT, fontSize: 14,
            fontFamily: "inherit", resize: "vertical", boxSizing: "border-box",
            outline: "none", lineHeight: 1.6
          }}
        />
      </div>

      {error && <div style={{ color: "#FF6B6B", fontSize: 13 }}>{error}</div>}

      <button onClick={generate} disabled={loading} style={{
        padding: "14px", background: loading ? BORDER : TEAL, border: "none",
        borderRadius: 10, color: loading ? MUTED : DARK, fontWeight: 700,
        fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
        fontFamily: "inherit", transition: "all 0.2s"
      }}>
        {loading ? "Génération..." : "✨ Générer l'annonce"}
      </button>

      {loading && <Spinner />}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { key: "titre", label: "Titre" },
            { key: "description", label: "Description" },
            { key: "prix", label: "Prix suggéré" },
            { key: "hashtags", label: "Hashtags référencement" },
          ].map(({ key, label }) => (
            <div key={key} style={{ background: DARK, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ color: TEAL, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
                <CopyButton text={result[key]} />
              </div>
              <p style={{ margin: 0, color: TEXT, fontSize: 14, lineHeight: 1.6 }}>{result[key]}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TAB 2 : Répondre aux messages ────────────────────────────────────────────
function MessagesTab() {
  const [selected, setSelected] = useState(null);
  const [custom, setCustom] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activeMessage = selected !== null ? MESSAGE_TEMPLATES[selected].text : custom;

  const generate = async () => {
    if (!activeMessage.trim()) { setError("Sélectionne ou écris un message."); return; }
    setError(""); setLoading(true); setReply("");
    try {
      const text = await callClaude(SYSTEM_MESSAGE, `Message de l'acheteur : "${activeMessage}"`);
      setReply(text.trim());
    } catch {
      setError("Erreur. Réessaie.");
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <label style={{ color: MUTED, fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
          Message reçu (templates rapides)
        </label>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {MESSAGE_TEMPLATES.map((t, i) => (
            <button key={i} onClick={() => { setSelected(i); setCustom(""); }} style={{
              padding: "8px 14px", border: `1px solid ${selected === i ? TEAL : BORDER}`,
              borderRadius: 20, background: selected === i ? `${TEAL}20` : "transparent",
              color: selected === i ? TEAL : MUTED, cursor: "pointer",
              fontSize: 13, fontFamily: "inherit", transition: "all 0.2s"
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ color: MUTED, fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
          Ou colle le message ici
        </label>
        <textarea
          value={selected !== null ? MESSAGE_TEMPLATES[selected].text : custom}
          onChange={e => { setCustom(e.target.value); setSelected(null); }}
          placeholder="Colle le message de l'acheteur..."
          rows={3}
          style={{
            marginTop: 8, width: "100%", background: DARK, border: `1px solid ${BORDER}`,
            borderRadius: 10, padding: "12px 14px", color: TEXT, fontSize: 14,
            fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none", lineHeight: 1.6
          }}
        />
      </div>

      {error && <div style={{ color: "#FF6B6B", fontSize: 13 }}>{error}</div>}

      <button onClick={generate} disabled={loading} style={{
        padding: "14px", background: loading ? BORDER : TEAL, border: "none",
        borderRadius: 10, color: loading ? MUTED : DARK, fontWeight: 700,
        fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
        fontFamily: "inherit", transition: "all 0.2s"
      }}>
        {loading ? "Rédaction..." : "💬 Rédiger la réponse"}
      </button>

      {loading && <Spinner />}

      {reply && (
        <div style={{ background: DARK, border: `1px solid ${TEAL}40`, borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: TEAL, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
              Réponse suggérée
            </span>
            <CopyButton text={reply} />
          </div>
          <p style={{ margin: 0, color: TEXT, fontSize: 14, lineHeight: 1.7 }}>{reply}</p>
        </div>
      )}
    </div>
  );
}

// ── APP PRINCIPALE ───────────────────────────────────────────────────────────
export default function VintedAssistant() {
  const [tab, setTab] = useState(0);

  return (
    <div style={{
      minHeight: "100vh", background: DARK, color: TEXT,
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif", padding: "0 0 40px"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        textarea:focus { border-color: ${TEAL} !important; }
      `}</style>

      {/* Header */}
      <div style={{
        background: CARD, borderBottom: `1px solid ${BORDER}`,
        padding: "20px 24px", marginBottom: 24
      }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, background: TEAL, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18
            }}>👕</div>
            <div>
              <h1 style={{
                margin: 0, fontSize: 20, fontWeight: 700,
                fontFamily: "'Space Grotesk', sans-serif", color: TEXT
              }}>
                Vinted <span style={{ color: TEAL }}>IA</span>
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: MUTED }}>Ton assistant vendeur personnel</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px" }}>
        {/* Tabs */}
        <div style={{
          display: "flex", gap: 6, background: CARD,
          border: `1px solid ${BORDER}`, borderRadius: 12,
          padding: 6, marginBottom: 24
        }}>
          <Tab label="📸 Créer annonce" active={tab === 0} onClick={() => setTab(0)} />
          <Tab label="💬 Répondre" active={tab === 1} onClick={() => setTab(1)} />
        </div>

        {/* Panel */}
        <div style={{
          background: CARD, border: `1px solid ${BORDER}`,
          borderRadius: 14, padding: 20
        }}>
          {tab === 0 ? <GenerateTab /> : <MessagesTab />}
        </div>

        {/* Footer */}
        <p style={{ textAlign: "center", color: MUTED, fontSize: 12, marginTop: 24 }}>
          Copie le texte généré → colle sur Vinted → vends plus vite 🚀
        </p>
      </div>
    </div>
  );
}
