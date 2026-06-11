import React, { useState, useEffect, useRef } from 'react';

interface Book {
  id: number;
  title: string;
  totalPages: number;
  wordCount: number;
  estimatedCompletionTime: number;
  chapterCount: number;
  readingDifficulty: string;
  readingProgress: number;
}

interface ReadingChunk {
  id: number;
  chunkIndex: number;
  title: string;
  content: string;
  startPage: number;
  endPage: number;
  wordCount: number;
  estimatedReadingTime: number;
  completed: boolean;
}

interface Message {
  sender: 'user' | 'assistant';
  text: string;
  citations?: {
    chunkId: number;
    chunkIndex: number;
    title: string;
    startPage: number;
    endPage: number;
  }[];
}

const API_BASE = 'http://localhost:8080/api';

type Language = 'en' | 'hi' | 'te';

const translations = {
  en: {
    languageLabel: 'Language',
    uploading: 'Uploading...',
    uploadPdf: 'Upload PDF',
    uploadErrorPrefix: 'Upload Error:',
    pdfOnly: 'Only PDF files are supported',
    uploadFailed: 'Error uploading PDF',
    backendUnavailable: 'Could not connect to the backend server.',
    welcome: 'Welcome to BookPlanner',
    welcomeDescription: "Upload any PDF book. We'll divide it into optimal 10-minute reading chunks, estimate completion time, and set up an AI Chatbot to answer your questions.",
    choosePdf: 'Choose a PDF book file',
    dragDrop: 'drag & drop or click to browse (max 50MB)',
    yourBooks: 'Your Books',
    readingProgress: 'Reading Progress',
    pages: 'PAGES',
    chunks: 'CHUNKS',
    difficulty: 'DIFFICULTY',
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    estimatedTotal: (minutes: number) => `Est. ${minutes} mins total`,
    readingPlanner: 'Reading Planner',
    completedCount: (completed: number, total: number) => `${completed} of ${total} completed`,
    pageRange: (start: number, end: number) => `Pages ${start}-${end}`,
    minRead: (minutes: number) => `${minutes} min read`,
    read: 'Read',
    aiAssistant: 'AI Reading Assistant',
    assistantIntro: (title: string) => `Hi! I am your AI assistant for **${title}**. You can ask me any questions about this book, and I'll find the answers directly from the text.`,
    chatProcessingError: 'Sorry, I ran into an error processing your query. Please make sure the AI service is online.',
    chatConnectionError: "I couldn't contact the chatbot server. Please check your network connection.",
    sourcesCited: 'Sources cited:',
    thinking: 'Thinking...',
    askAbout: (title: string) => `Ask about "${title}"...`,
    selectBookFirst: 'Select a book first',
    bookLabel: 'Book:',
    close: 'Close',
    words: (count: number) => `${count} words`,
    estimatedReadTime: (minutes: number) => `Estimated read time: ${minutes} mins`,
    markIncomplete: 'Mark Incomplete',
    markCompleted: 'Mark Completed',
  },
  hi: {
    languageLabel: 'भाषा',
    uploading: 'अपलोड हो रहा है...',
    uploadPdf: 'PDF अपलोड करें',
    uploadErrorPrefix: 'अपलोड त्रुटि:',
    pdfOnly: 'केवल PDF फाइलें समर्थित हैं',
    uploadFailed: 'PDF अपलोड करने में त्रुटि',
    backendUnavailable: 'बैकएंड सर्वर से कनेक्ट नहीं हो सका।',
    welcome: 'BookPlanner में आपका स्वागत है',
    welcomeDescription: 'कोई भी PDF पुस्तक अपलोड करें। हम उसे बेहतर 10 मिनट के पढ़ने वाले हिस्सों में बांटेंगे, पूरा करने का समय बताएंगे, और आपके सवालों के जवाब देने के लिए AI चैटबॉट तैयार करेंगे।',
    choosePdf: 'PDF पुस्तक फाइल चुनें',
    dragDrop: 'खींचकर छोड़ें या ब्राउज करने के लिए क्लिक करें (अधिकतम 50MB)',
    yourBooks: 'आपकी पुस्तकें',
    readingProgress: 'पढ़ने की प्रगति',
    pages: 'पृष्ठ',
    chunks: 'भाग',
    difficulty: 'कठिनाई',
    easy: 'आसान',
    medium: 'मध्यम',
    hard: 'कठिन',
    estimatedTotal: (minutes: number) => `अनुमानित कुल ${minutes} मिनट`,
    readingPlanner: 'रीडिंग प्लानर',
    completedCount: (completed: number, total: number) => `${total} में से ${completed} पूरे`,
    pageRange: (start: number, end: number) => `पृष्ठ ${start}-${end}`,
    minRead: (minutes: number) => `${minutes} मिनट पढ़ना`,
    read: 'पढ़ें',
    aiAssistant: 'AI रीडिंग सहायक',
    assistantIntro: (title: string) => `नमस्ते! मैं **${title}** के लिए आपका AI सहायक हूं। आप इस पुस्तक के बारे में कोई भी सवाल पूछ सकते हैं, और मैं सीधे पाठ से उत्तर ढूंढूंगा।`,
    chatProcessingError: 'माफ कीजिए, आपका प्रश्न प्रोसेस करते समय त्रुटि हुई। कृपया सुनिश्चित करें कि AI सेवा ऑनलाइन है।',
    chatConnectionError: 'मैं चैटबॉट सर्वर से संपर्क नहीं कर सका। कृपया अपना नेटवर्क कनेक्शन जांचें।',
    sourcesCited: 'स्रोत:',
    thinking: 'सोच रहा है...',
    askAbout: (title: string) => `"${title}" के बारे में पूछें...`,
    selectBookFirst: 'पहले पुस्तक चुनें',
    bookLabel: 'पुस्तक:',
    close: 'बंद करें',
    words: (count: number) => `${count} शब्द`,
    estimatedReadTime: (minutes: number) => `अनुमानित पढ़ने का समय: ${minutes} मिनट`,
    markIncomplete: 'अधूरा चिह्नित करें',
    markCompleted: 'पूरा चिह्नित करें',
  },
  te: {
    languageLabel: 'భాష',
    uploading: 'అప్లోడ్ అవుతోంది...',
    uploadPdf: 'PDF అప్లోడ్ చేయండి',
    uploadErrorPrefix: 'అప్లోడ్ లోపం:',
    pdfOnly: 'PDF ఫైళ్లకు మాత్రమే మద్దతు ఉంది',
    uploadFailed: 'PDF అప్లోడ్ చేయడంలో లోపం',
    backendUnavailable: 'బ్యాకెండ్ సర్వర్‌కు కనెక్ట్ కాలేకపోయాం.',
    welcome: 'BookPlanner కు స్వాగతం',
    welcomeDescription: 'ఏదైనా PDF పుస్తకాన్ని అప్లోడ్ చేయండి. మేము దాన్ని సరైన 10 నిమిషాల చదువు భాగాలుగా విభజించి, పూర్తిచేసే సమయాన్ని అంచనా వేసి, మీ ప్రశ్నలకు సమాధానం ఇచ్చే AI చాట్‌బాట్‌ను సిద్ధం చేస్తాము.',
    choosePdf: 'PDF పుస్తక ఫైల్ ఎంచుకోండి',
    dragDrop: 'డ్రాగ్ & డ్రాప్ చేయండి లేదా బ్రౌజ్ చేయడానికి క్లిక్ చేయండి (గరిష్ఠం 50MB)',
    yourBooks: 'మీ పుస్తకాలు',
    readingProgress: 'చదువు పురోగతి',
    pages: 'పేజీలు',
    chunks: 'భాగాలు',
    difficulty: 'కష్టత',
    easy: 'సులభం',
    medium: 'మధ్యస్థం',
    hard: 'కష్టం',
    estimatedTotal: (minutes: number) => `మొత్తం అంచనా ${minutes} నిమిషాలు`,
    readingPlanner: 'రీడింగ్ ప్లానర్',
    completedCount: (completed: number, total: number) => `${total}లో ${completed} పూర్తయ్యాయి`,
    pageRange: (start: number, end: number) => `పేజీలు ${start}-${end}`,
    minRead: (minutes: number) => `${minutes} నిమిషాల చదువు`,
    read: 'చదవండి',
    aiAssistant: 'AI రీడింగ్ అసిస్టెంట్',
    assistantIntro: (title: string) => `నమస్తే! **${title}** కోసం నేను మీ AI అసిస్టెంట్‌ని. ఈ పుస్తకం గురించి మీరు ఏ ప్రశ్నైనా అడగవచ్చు, నేను సమాధానాలను నేరుగా పాఠ్యం నుంచి కనుగొంటాను.`,
    chatProcessingError: 'క్షమించండి, మీ ప్రశ్నను ప్రాసెస్ చేయడంలో లోపం వచ్చింది. AI సేవ ఆన్‌లైన్‌లో ఉందో లేదో చూసుకోండి.',
    chatConnectionError: 'చాట్‌బాట్ సర్వర్‌ను సంప్రదించలేకపోయాను. దయచేసి మీ నెట్‌వర్క్ కనెక్షన్‌ను తనిఖీ చేయండి.',
    sourcesCited: 'సూచించిన మూలాలు:',
    thinking: 'ఆలోచిస్తోంది...',
    askAbout: (title: string) => `"${title}" గురించి అడగండి...`,
    selectBookFirst: 'ముందుగా పుస్తకాన్ని ఎంచుకోండి',
    bookLabel: 'పుస్తకం:',
    close: 'మూసివేయండి',
    words: (count: number) => `${count} పదాలు`,
    estimatedReadTime: (minutes: number) => `అంచనా చదువు సమయం: ${minutes} నిమిషాలు`,
    markIncomplete: 'అసంపూర్తిగా గుర్తించండి',
    markCompleted: 'పూర్తయింది అని గుర్తించండి',
  },
} as const;

const difficultyLabels: Record<Language, Record<string, string>> = {
  en: { Easy: translations.en.easy, Medium: translations.en.medium, Hard: translations.en.hard },
  hi: { Easy: translations.hi.easy, Medium: translations.hi.medium, Hard: translations.hi.hard },
  te: { Easy: translations.te.easy, Medium: translations.te.medium, Hard: translations.te.hard },
};

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [chunks, setChunks] = useState<ReadingChunk[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // UI states
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sendingChat, setSendingChat] = useState(false);
  
  // Chat input
  const [query, setQuery] = useState('');
  
  // Reader Modal state
  const [activeReaderChunk, setActiveReaderChunk] = useState<ReadingChunk | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[language];

  // Initial load: Fetch all books
  useEffect(() => {
    fetchBooks();
  }, []);

  // Fetch chunks and reset chat when a new book is selected
  useEffect(() => {
    if (selectedBook) {
      fetchChunks(selectedBook.id);
      setMessages([
        {
          sender: 'assistant',
          text: translations[language].assistantIntro(selectedBook.title)
        }
      ]);
    } else {
      setChunks([]);
      setMessages([]);
    }
  }, [selectedBook, language]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sendingChat]);

  const fetchBooks = async () => {
    setLoadingBooks(true);
    try {
      const res = await fetch(`${API_BASE}/books`);
      if (res.ok) {
        const data = await res.json();
        setBooks(data);
        // Automatically select the first book if none selected
        if (data.length > 0 && !selectedBook) {
          setSelectedBook(data[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching books:", err);
    } finally {
      setLoadingBooks(false);
    }
  };

  const fetchChunks = async (bookId: number) => {
    setLoadingChunks(true);
    try {
      const res = await fetch(`${API_BASE}/books/${bookId}/chunks`);
      if (res.ok) {
        const data = await res.json();
        setChunks(data);
      }
    } catch (err) {
      console.error("Error fetching chunks:", err);
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadError(t.pdfOnly);
      return;
    }

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/books/upload`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const newBook = await res.json();
        setBooks(prev => [newBook, ...prev]);
        setSelectedBook(newBook);
      } else {
        const errText = await res.text();
        setUploadError(errText || t.uploadFailed);
      }
    } catch (err) {
      setUploadError(t.backendUnavailable);
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const toggleChunkCompleted = async (chunk: ReadingChunk) => {
    if (!selectedBook) return;
    
    // Optimistic UI update
    const newCompletedState = !chunk.completed;
    setChunks(prev => prev.map(c => c.id === chunk.id ? { ...c, completed: newCompletedState } : c));

    try {
      const res = await fetch(`${API_BASE}/books/${selectedBook.id}/chunks/${chunk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: newCompletedState })
      });

      if (res.ok) {
        const data = await res.json();
        // Update the book's reading progress percentage
        setSelectedBook(prev => prev ? { ...prev, readingProgress: data.readingProgress } : null);
        setBooks(prev => prev.map(b => b.id === selectedBook.id ? { ...b, readingProgress: data.readingProgress } : b));
      } else {
        // Rollback on error
        setChunks(prev => prev.map(c => c.id === chunk.id ? { ...c, completed: !newCompletedState } : c));
      }
    } catch (err) {
      console.error("Error updating chunk:", err);
      // Rollback on error
      setChunks(prev => prev.map(c => c.id === chunk.id ? { ...c, completed: !newCompletedState } : c));
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !selectedBook || sendingChat) return;

    const userText = query;
    setQuery('');
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setSendingChat(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: selectedBook.id,
          question: userText
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, {
          sender: 'assistant',
          text: data.answer,
          citations: data.citations
        }]);
      } else {
        setMessages(prev => [...prev, {
          sender: 'assistant',
          text: t.chatProcessingError
        }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        sender: 'assistant',
        text: t.chatConnectionError
      }]);
    } finally {
      setSendingChat(false);
    }
  };

  // Helper icons (SVGs)
  const uploadIcon = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );

  const bookIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );

  const clockIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );

  const sendIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">
          {bookIcon}
          <span>BookPlanner</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
            <span>{t.languageLabel}</span>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value as Language)}
              className="language-select"
              aria-label={t.languageLabel}
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="te">తెలుగు</option>
            </select>
          </label>
          <button 
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14 }}></div>
                <span>{t.uploading}</span>
              </>
            ) : (
              <>
                {uploadIcon}
                <span>{t.uploadPdf}</span>
              </>
            )}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".pdf" 
            style={{ display: 'none' }}
          />
        </div>
      </header>

      <main className="main-content">
        {uploadError && (
          <div className="glass-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444' }}>
            <strong>{t.uploadErrorPrefix}</strong> {uploadError}
          </div>
        )}

        {books.length === 0 && !uploading ? (
          // Empty state / First upload
          <div className="glass-card" style={{ maxWidth: 600, margin: '4rem auto', width: '100%' }}>
            <h2 className="title-primary" style={{ textAlign: 'center', marginBottom: '1rem' }}>{t.welcome}</h2>
            <p className="subtitle-primary" style={{ textAlign: 'center', marginBottom: '2rem' }}>
              {t.welcomeDescription}
            </p>
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              <div className="upload-icon">{uploadIcon}</div>
              <h3>{t.choosePdf}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.dragDrop}</p>
            </div>
          </div>
        ) : (
          // Main Dashboard Workspace
          <div className="dashboard-grid">
            
            {/* Left Column: Library & Metadata */}
            <div className="sidebar-column" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Library list */}
              <div className="glass-card">
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-main)' }}>{t.yourBooks}</h3>
                {loadingBooks ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                    <div className="spinner"></div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                    {books.map(book => (
                      <button
                        key={book.id}
                        onClick={() => setSelectedBook(book)}
                        className={`btn`}
                        style={{
                          width: '100%',
                          justifyContent: 'flex-start',
                          background: selectedBook?.id === book.id ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.02)',
                          color: selectedBook?.id === book.id ? '#fff' : 'var(--text-main)',
                          border: '1px solid ' + (selectedBook?.id === book.id ? 'transparent' : 'var(--border-color)'),
                          padding: '0.65rem 1rem',
                        }}
                      >
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'left' }}>
                          {book.title}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Book Metadata details card */}
              {selectedBook && (
                <div className="glass-card">
                  <h3 style={{ marginBottom: '0.75rem', fontSize: '1.25rem', color: 'var(--text-main)' }}>{selectedBook.title}</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
                    
                    {/* Completion rate */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--text-sub)' }}>{t.readingProgress}</span>
                        <span style={{ fontWeight: 600, color: 'var(--secondary)' }}>{selectedBook.readingProgress}%</span>
                      </div>
                      <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${selectedBook.readingProgress}%` }}></div>
                      </div>
                    </div>

                    <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />

                    {/* Stats details */}
                    <div style={{ display: 'flex', gap: '1.5rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>{t.pages}</span>
                        <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{selectedBook.totalPages}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>{t.chunks}</span>
                        <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{chunks.length}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>{t.difficulty}</span>
                        <span 
                          style={{ 
                            fontWeight: 600, 
                            fontSize: '0.85rem',
                            color: selectedBook.readingDifficulty === 'Easy' ? '#10b981' : selectedBook.readingDifficulty === 'Hard' ? '#ef4444' : '#f59e0b',
                            background: selectedBook.readingDifficulty === 'Easy' ? 'rgba(16,185,129,0.1)' : selectedBook.readingDifficulty === 'Hard' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                            padding: '0.1rem 0.5rem',
                            borderRadius: '4px',
                            display: 'inline-block',
                            marginTop: '0.1rem'
                          }}
                        >
                          {difficultyLabels[language][selectedBook.readingDifficulty] ?? selectedBook.readingDifficulty}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-sub)', marginTop: '0.5rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        {clockIcon}
                        {t.estimatedTotal(selectedBook.estimatedCompletionTime)}
                      </span>
                    </div>

                  </div>
                </div>
              )}
            </div>

            {/* Middle Column: Reading Planner */}
            <div className="planner-column" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h3 style={{ marginBottom: '1.25rem', fontSize: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{t.readingPlanner}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                    {t.completedCount(chunks.filter(c => c.completed).length, chunks.length)}
                  </span>
                </h3>

                {loadingChunks ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                    <div className="spinner"></div>
                  </div>
                ) : (
                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: '550px', paddingRight: '0.5rem' }}>
                    {chunks.map((chunk) => (
                      <div 
                        key={chunk.id} 
                        className={`reading-item ${chunk.completed ? 'completed' : ''}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                          <input 
                            type="checkbox"
                            checked={chunk.completed}
                            onChange={() => toggleChunkCompleted(chunk)}
                            style={{ 
                              width: '18px', 
                              height: '18px', 
                              accentColor: 'var(--primary)',
                              cursor: 'pointer' 
                            }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span className="reading-title" style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                              {chunk.title}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                              {t.pageRange(chunk.startPage, chunk.endPage)} • {t.minRead(chunk.estimatedReadingTime)}
                            </span>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => setActiveReaderChunk(chunk)}
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                        >
                          {t.read}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: AI Assistant Chat */}
            <div className="chat-column" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  {t.aiAssistant}
                </h3>
                
                <div className="chat-container">
                  <div className="chat-messages">
                    {messages.map((msg, index) => (
                      <div 
                        key={index}
                        className={`chat-bubble ${msg.sender === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}
                      >
                        <div>{msg.text}</div>
                        {msg.citations && msg.citations.length > 0 && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', width: '100%', marginTop: '0.25rem' }}>
                              {t.sourcesCited}
                            </span>
                            {msg.citations.map(cit => (
                              <button 
                                key={cit.chunkId}
                                onClick={() => {
                                  const matchingChunk = chunks.find(c => c.id === cit.chunkId);
                                  if (matchingChunk) {
                                    setActiveReaderChunk(matchingChunk);
                                  }
                                }}
                                className="citation-badge"
                              >
                                {cit.title} (p.{cit.startPage}-{cit.endPage})
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {sendingChat && (
                      <div className="chat-bubble chat-bubble-assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div className="spinner" style={{ width: 12, height: 12, borderWidth: '2px' }}></div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.thinking}</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={handleSendChat} className="chat-input-wrapper">
                    <input 
                      type="text"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder={selectedBook ? t.askAbout(selectedBook.title) : t.selectBookFirst}
                      disabled={!selectedBook || sendingChat}
                      className="chat-input"
                    />
                    <button 
                      type="submit" 
                      disabled={!selectedBook || sendingChat || !query.trim()}
                      className="btn btn-primary"
                      style={{ padding: '0.75rem 1rem' }}
                    >
                      {sendIcon}
                    </button>
                  </form>
                </div>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* Reader overlay modal */}
      {activeReaderChunk && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}>
          <div className="glass-card" style={{ 
            maxWidth: '800px', 
            width: '100%', 
            maxHeight: '80vh', 
            display: 'flex', 
            flexDirection: 'column', 
            background: 'var(--bg-surface-solid)',
            padding: '2rem',
            boxShadow: '0 0 50px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{activeReaderChunk.title}</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {t.bookLabel} {selectedBook?.title} • {t.pageRange(activeReaderChunk.startPage, activeReaderChunk.endPage)}
                </span>
              </div>
              <button 
                onClick={() => setActiveReaderChunk(null)}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                {t.close}
              </button>
            </div>
            
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              fontSize: '1rem', 
              lineHeight: '1.7', 
              color: '#cbd5e1', 
              paddingRight: '1rem',
              whiteSpace: 'pre-wrap'
            }}>
              {activeReaderChunk.content}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '1.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t.words(activeReaderChunk.wordCount)} • {t.estimatedReadTime(activeReaderChunk.estimatedReadingTime)}
              </span>
              <button
                className={`btn ${activeReaderChunk.completed ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => {
                  toggleChunkCompleted(activeReaderChunk);
                  // Update active modal state object completed flag to sync display status
                  setActiveReaderChunk(prev => prev ? { ...prev, completed: !prev.completed } : null);
                }}
              >
                {activeReaderChunk.completed ? t.markIncomplete : t.markCompleted}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
