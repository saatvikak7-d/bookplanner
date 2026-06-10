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

export default function App() {
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
          text: `Hi! I am your AI assistant for **${selectedBook.title}**. You can ask me any questions about this book, and I'll find the answers directly from the text.`
        }
      ]);
    } else {
      setChunks([]);
      setMessages([]);
    }
  }, [selectedBook]);

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
      setUploadError("Only PDF files are supported");
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
        setUploadError(errText || "Error uploading PDF");
      }
    } catch (err) {
      setUploadError("Could not connect to the backend server.");
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
          text: "Sorry, I ran into an error processing your query. Please make sure the AI service is online."
        }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        sender: 'assistant',
        text: "I couldn't contact the chatbot server. Please check your network connection."
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
        <div>
          <button 
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <div className="spinner" style={{ width: 14, height: 14 }}></div>
                <span>Uploading...</span>
              </>
            ) : (
              <>
                {uploadIcon}
                <span>Upload PDF</span>
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
            <strong>Upload Error:</strong> {uploadError}
          </div>
        )}

        {books.length === 0 && !uploading ? (
          // Empty state / First upload
          <div className="glass-card" style={{ maxWidth: 600, margin: '4rem auto', width: '100%' }}>
            <h2 className="title-primary" style={{ textAlign: 'center', marginBottom: '1rem' }}>Welcome to BookPlanner</h2>
            <p className="subtitle-primary" style={{ textAlign: 'center', marginBottom: '2rem' }}>
              Upload any PDF book. We'll divide it into optimal 10-minute reading chunks, estimate completion time, and set up an AI Chatbot to answer your questions.
            </p>
            <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              <div className="upload-icon">{uploadIcon}</div>
              <h3>Choose a PDF book file</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>drag & drop or click to browse (max 50MB)</p>
            </div>
          </div>
        ) : (
          // Main Dashboard Workspace
          <div className="dashboard-grid">
            
            {/* Left Column: Library & Metadata */}
            <div className="sidebar-column" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Library list */}
              <div className="glass-card">
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-main)' }}>Your Books</h3>
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
                        <span style={{ color: 'var(--text-sub)' }}>Reading Progress</span>
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
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>PAGES</span>
                        <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{selectedBook.totalPages}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>CHUNKS</span>
                        <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>{chunks.length}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>DIFFICULTY</span>
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
                          {selectedBook.readingDifficulty}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-sub)', marginTop: '0.5rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        {clockIcon}
                        Est. {selectedBook.estimatedCompletionTime} mins total
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
                  <span>Reading Planner</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                    {chunks.filter(c => c.completed).length} of {chunks.length} completed
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
                              Pages {chunk.startPage}–{chunk.endPage} • {chunk.estimatedReadingTime} min read
                            </span>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => setActiveReaderChunk(chunk)}
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                        >
                          Read
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
                  AI Reading Assistant
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
                              Sources cited:
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
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Thinking...</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <form onSubmit={handleSendChat} className="chat-input-wrapper">
                    <input 
                      type="text"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder={selectedBook ? `Ask about "${selectedBook.title}"...` : "Select a book first"}
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
                  Book: {selectedBook?.title} • Pages {activeReaderChunk.startPage}–{activeReaderChunk.endPage}
                </span>
              </div>
              <button 
                onClick={() => setActiveReaderChunk(null)}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
              >
                Close
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
                {activeReaderChunk.wordCount} words • Estimated read time: {activeReaderChunk.estimatedReadingTime} mins
              </span>
              <button
                className={`btn ${activeReaderChunk.completed ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => {
                  toggleChunkCompleted(activeReaderChunk);
                  // Update active modal state object completed flag to sync display status
                  setActiveReaderChunk(prev => prev ? { ...prev, completed: !prev.completed } : null);
                }}
              >
                {activeReaderChunk.completed ? 'Mark Incomplete' : 'Mark Completed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
