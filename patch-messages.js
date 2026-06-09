const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app/(protected)/messages/page.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add activeAppId state
content = content.replace(
  "const activeChatId = searchParams.get('chat');",
  "const activeChatId = searchParams.get('chat');\n  const activeAppId = searchParams.get('application');"
);

// 2. Add state for appThreads
content = content.replace(
  "const [groupProfilesMap, setGroupProfilesMap] = useState({});",
  `const [groupProfilesMap, setGroupProfilesMap] = useState({});\n\n  const [appThreads, setAppThreads] = useState([]);\n  const [loadingApps, setLoadingApps] = useState(false);\n  const [activeAppThread, setActiveAppThread] = useState(null);\n\n  // Auto-switch tabs based on URL\n  useEffect(() => {\n    if (activeAppId) setActiveTab('applications');\n    else if (activeChatId) setActiveTab('direct');\n  }, [activeAppId, activeChatId]);`
);

// 3. Add App Threads and Messages fetching logic before realtime subscription (line 230 approx)
const appFetchingLogic = `
  // 2.2 Fetch App Threads
  useEffect(() => {
    if (activeTab !== 'applications' || !userId) return;

    async function loadAppThreads() {
      try {
        setLoadingApps(true);
        
        // If activeAppId exists, ensure thread is created
        if (activeAppId) {
          const { data: existing } = await supabase.from('application_threads').select('id').eq('application_id', activeAppId).maybeSingle();
          if (!existing) {
            const { data: appData } = await supabase.from('applications').select('job_id, applicant_id, job:jobs(poster_id)').eq('id', activeAppId).maybeSingle();
            if (appData) {
              await supabase.from('application_threads').insert({
                application_id: activeAppId,
                job_id: appData.job_id,
                applicant_id: appData.applicant_id,
                company_id: appData.job.poster_id
              });
            }
          }
        }

        // Fetch threads
        const { data: threads, error } = await supabase
          .from('application_threads')
          .select('*, application:applications(status), job:jobs(title), applicant:profiles!applicant_id(name, avatar_url, currentRole), company:profiles!company_id(name, avatar_url, currentRole)')
          .or(\`applicant_id.eq.\${userId},company_id.eq.\${userId}\`)
          .order('last_message_at', { ascending: false });

        if (!error && threads) {
          setAppThreads(threads);
          if (activeAppId) {
            const active = threads.find(t => t.application_id === activeAppId);
            setActiveAppThread(active || null);
          }
        }
      } catch (err) {
        console.error('Error app threads:', err);
      } finally {
        setLoadingApps(false);
      }
    }
    loadAppThreads();
  }, [activeTab, userId, activeAppId]);

  // 2.3 Fetch App Messages
  useEffect(() => {
    if (activeTab !== 'applications') {
      if (activeTab === 'applications') setMessages([]);
      return;
    }
    if (!activeAppThread) return;

    async function loadAppMessages() {
      try {
        setLoadingMessages(true);
        const { data, error } = await supabase
          .from('application_messages')
          .select('*')
          .eq('thread_id', activeAppThread.id)
          .order('created_at', { ascending: true });
        if (!error) setMessages(data || []);
      } finally {
        setLoadingMessages(false);
      }
    }
    loadAppMessages();
  }, [activeAppThread, activeTab]);

  // 3. Realtime messages subscription`;

content = content.replace("// 3. Realtime messages subscription", appFetchingLogic);

// 4. App Realtime subscription
const appRealtimeLogic = `
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatId]);

  // 3.5 Realtime for Application Messages
  useEffect(() => {
    if (!activeAppThread || activeTab !== 'applications') return;

    const channel = supabase
      .channel(\`public:app_messages:\${activeAppThread.id}\`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'application_messages' },
        (payload) => {
          if (payload.new.thread_id === activeAppThread.id) {
            setMessages((prev) => {
              if (prev.some(m => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeAppThread, activeTab]);
`;
content = content.replace(
  "    return () => {\n      supabase.removeChannel(channel);\n    };\n  }, [activeChatId]);",
  appRealtimeLogic
);

// 5. Send message logic
const sendLogic = `const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!newMessage.trim() || !currentUser.id || sending) return;

    if (activeTab === 'applications' && activeAppThread) {
      try {
        setSending(true);
        const { data, error } = await supabase.from('application_messages').insert({
          thread_id: activeAppThread.id,
          sender_id: currentUser.id,
          body: newMessage.trim()
        }).select().maybeSingle();

        if (error) throw error;
        setNewMessage('');
        setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data]);
      } catch (err) {
        console.error(err);
        showToast(err.message || 'Failed to send message', 'error');
      } finally {
        setSending(false);
      }
      return;
    }

    if (!activeChatId) return;`;

content = content.replace(
  "  const handleSendMessage = async (e) => {\n    e?.preventDefault();\n    if (!newMessage.trim() || !activeChatId || !currentUser.id || sending) return;",
  sendLogic
);

// 6. Fix Applications tab left panel
const appsPanelOld = `{activeTab === 'applications' && (
            <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400 mt-12">
              <MessageSquare size={44} className="text-gray-300 mb-3" />
              <p className="text-base font-semibold text-gray-600">No application conversations yet.</p>
              <p className="text-sm text-gray-400 mt-1">Company applications will appear here.</p>
            </div>
          )}`;

const appsPanelNew = `{activeTab === 'applications' && (
            <>
              {loadingApps ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-3">
                  <Loader2 className="animate-spin text-[#002b4e]" size={28} />
                  <span className="text-base font-medium">Loading applications...</span>
                </div>
              ) : appThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400 mt-12">
                  <MessageSquare size={44} className="text-gray-300 mb-3" />
                  <p className="text-base font-semibold text-gray-600">No application conversations yet.</p>
                  <p className="text-sm text-gray-400 mt-1">Company applications will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {appThreads.filter(t => t.job?.title?.toLowerCase().includes(searchTerm.toLowerCase())).map((thread) => {
                    const isApplicant = thread.applicant_id === currentUser.id;
                    const partner = isApplicant ? thread.company : thread.applicant;
                    const isActive = activeAppId === thread.application_id;

                    return (
                      <Link
                        key={thread.id}
                        href={\`?application=\${thread.application_id}\`}
                        className={\`w-full flex flex-col gap-1 p-4 text-left cursor-pointer transition-colors duration-200 border-l-4 \${
                          isActive ? 'bg-gray-100 border-blue-900' : 'hover:bg-gray-50 border-transparent'
                        }\`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-blue-600 truncate">{partner?.name || 'Unknown'}</span>
                          <span className="text-[10px] text-gray-400 font-medium shrink-0">
                            {new Date(thread.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <h2 className="text-sm font-bold text-[#002b4e] truncate mt-0.5">
                          {thread.job?.title || 'Job'}
                        </h2>
                        {thread.application?.status && (
                          <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 bg-gray-200 text-gray-700 rounded w-max">
                            {thread.application.status}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}`;
content = content.replace(appsPanelOld, appsPanelNew);

// 7. Render right panel for Applications
content = content.replace(
  "        {activeConv && activePartner && activeTab === 'direct' ? (",
  `        {(activeTab === 'applications' && activeAppThread) ? (
          <>
            {/* Chat stage header for App Thread */}
            <header className="flex-none w-full bg-white border-b border-gray-200 z-10 flex items-center justify-between px-4 py-3 min-h-[64px]">
              <div className="flex items-center min-w-0 ml-4">
                <button 
                  onClick={() => router.push('/messages')}
                  className="mr-2 p-1 text-gray-500 hover:text-[#002b4e] md:hidden"
                >
                  <ArrowLeft className="h-6 w-6" />
                </button>
                <div className="flex items-center gap-3">
                  {(() => {
                    const isApplicant = activeAppThread.applicant_id === currentUser.id;
                    const partner = isApplicant ? activeAppThread.company : activeAppThread.applicant;
                    return (
                      <>
                        {partner?.avatar_url ? (
                          <img 
                            src={partner.avatar_url} 
                            alt="Avatar" 
                            className="h-10 w-10 rounded-full object-cover" 
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-500 font-bold">
                            {partner?.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <h2 className="text-base font-bold text-[#002b4e] truncate">{activeAppThread.job?.title || 'Application'}</h2>
                          <p className="text-sm text-gray-500 truncate">{partner?.name || 'Unknown'}</p>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            </header>

            {/* Message Feed */}
            <main className="flex-1 min-h-0 overflow-y-auto w-full bg-gray-50 p-4 scroll-smooth flex flex-col space-y-4 no-scrollbar">
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400 space-y-3">
                  <Loader2 className="animate-spin text-[#002b4e]" size={28} />
                  <span className="text-base font-medium">Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center text-gray-400">
                  <MessageSquare size={36} className="text-gray-300 mb-2" />
                  <p className="text-base font-semibold text-gray-500">No messages yet</p>
                  <p className="text-sm text-gray-400 mt-1">Send a message to start the conversation.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {messages.map((message) => {
                    const isOwn = message.sender_id === currentUser.id;
                    
                    return (
                      <div
                        key={message.id}
                        className={\`flex w-full px-2 \${isOwn ? 'justify-end' : 'justify-start'}\`}
                      >
                        <div className={\`max-w-[85%] flex flex-col \${isOwn ? 'items-end' : 'items-start'}\`}>
                          <div
                            className={\`px-4 py-2 text-[1.1rem] leading-relaxed shadow-sm transition-all break-words whitespace-pre-wrap \${
                              isOwn
                                ? 'bg-blue-950 text-white rounded-2xl rounded-tr-none'
                                : 'bg-gray-100 text-gray-900 rounded-2xl rounded-tl-none'
                            }\`}
                          >
                            <p className="whitespace-pre-wrap break-words">{message.body}</p>
                          </div>
                          
                          <span className="text-xs text-gray-400 mt-0.5 font-medium px-1">
                            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              )}
            </main>

            <form 
              onSubmit={handleSendMessage}
              className="flex-none w-full bg-white border-t border-gray-200 z-20 flex items-center gap-3 px-5 pt-4 pb-2 messages-composer"
            >
              <input
                type="text"
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sending}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-700 placeholder-gray-400 outline-none focus:border-[#002b4e] transition-colors"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full min-w-[50px] min-h-[50px] flex items-center justify-center font-bold transition-all duration-150 shadow-sm disabled:opacity-40 cursor-pointer"
              >
                {sending ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </form>
          </>
        ) : activeConv && activePartner && activeTab === 'direct' ? (`
);

// 8. Fix left panel mobile layout classes
content = content.replace(
  \`      <div 
        className={activeChatId 
          ? "hidden md:flex flex-col w-1/3 lg:w-1/4 border-r border-gray-200 overflow-hidden bg-white h-full min-h-0" 
          : "flex flex-col w-full md:w-1/3 lg:w-1/4 border-r border-gray-200 overflow-hidden bg-white h-full min-h-0"
        }
      >\`,
  \`      <div 
        className={(activeChatId || activeAppId) 
          ? "hidden md:flex flex-col w-1/3 lg:w-1/4 border-r border-gray-200 overflow-hidden bg-white h-full min-h-0" 
          : "flex flex-col w-full md:w-1/3 lg:w-1/4 border-r border-gray-200 overflow-hidden bg-white h-full min-h-0"
        }
      >\`
);

content = content.replace(
  \`      <div 
        className={activeChatId 
          ? "flex-1 flex flex-col h-full bg-white w-full overflow-hidden min-h-0" 
          : "hidden md:flex flex-1 flex-col h-full bg-white overflow-hidden min-h-0"
        }
      >\`,
  \`      <div 
        className={(activeChatId || activeAppId) 
          ? "flex-1 flex flex-col h-full bg-white w-full overflow-hidden min-h-0" 
          : "hidden md:flex flex-1 flex-col h-full bg-white overflow-hidden min-h-0"
        }
      >\`
);

fs.writeFileSync(filePath, content);
console.log('Patched messages/page.jsx successfully!');
