'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { PersonTimeline, TimelineSegment, RawLogEvent, MeetingNote } from '@/lib/types';
import { fetchLogs, transformLogsToSegments } from '@/lib/api';
import { analyzeAllTasks, getPersonSummaries } from '@/lib/workflow-engine';
import { StandupInspector } from '@/components/inspector/StandupInspector';
import { PersonnelOverview } from '@/components/dashboard/PersonnelOverview';
import { TaskOverview } from '@/components/dashboard/TaskOverview';
import { SprintStartManager } from '@/components/dashboard/SprintStartManager';
import { DailyMeetingView } from '@/components/dashboard/DailyMeetingView';
import { DailyRecapView } from '@/components/dashboard/DailyRecapView';
import { NextSprintPlanningView } from '@/components/dashboard/NextSprintPlanningView';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useHighRisk } from '@/lib/hooks/useHighRisk';
import { useMeetingNotes } from '@/lib/hooks/useMeetingNotes';
import { useSprintStart } from '@/lib/hooks/useSprintStart';
import { format } from 'date-fns';
import { useSprintConfig } from '@/lib/hooks/useSprintConfig';
import { SprintSettings } from '@/components/inspector/SprintSettings';
import { WebhookSettingsModal } from '@/components/dashboard/WebhookSettingsModal';
import { DataManagementModal } from '@/components/dashboard/DataManagementModal';
import { usePersonWebhooks } from '@/lib/hooks/usePersonWebhooks';
import {
  Activity,
  Calendar,
  CheckCircle2,
  Database,
  Users,
  LayoutGrid,
  ListChecks,
  AlertTriangle,
  RefreshCw,
  Settings,
  Flag,
  UsersRound,
  History,
  Code,
  Play,
  Target,
} from 'lucide-react';

type ViewTab = 'dailyMeeting' | 'nextSprintPlanning' | 'dailyRecap' | 'personnel' | 'tasks' | 'sprintStart' | 'sandbox';

export default function Home() {
  const { configs, manualOverride, saveManualOverride, getActiveSprintNumber, refetch: refetchSprintConfig } = useSprintConfig();

  const [data, setData] = useState<PersonTimeline[]>([]);
  const [rawLogs, setRawLogs] = useState<RawLogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState<TimelineSegment | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('dailyMeeting');
  const [showSettings, setShowSettings] = useState(false);
  const [showWebhookSettings, setShowWebhookSettings] = useState(false);

  const activeSprint = getActiveSprintNumber();

  function getSprintLabel(sprintNum: string): string {
    const config = configs.find((s) => s.number === sprintNum);
    if (!config) return `Sprint ${sprintNum}`;
    return `Sprint ${sprintNum} · ${format(new Date(config.startDate), 'MMM d')} – ${format(new Date(config.endDate), 'MMM d')}`;
  }

  const { highRiskIds, toggleHighRisk, isHighRisk } = useHighRisk();
  const { addNote, updateNote, deleteNote, getNotesForTask, notes } = useMeetingNotes();
  const {
    getSprintStartSnapshot,
    saveOverride,
    bulkSaveOverrides,
    clearOverride,
    clearAllOverrides,
    confirmAllAsOverrides,
  } = useSprintStart();

  useEffect(() => {
    import('@/lib/migration').then(m => m.migrateLocalStorageToAPI());
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      setLoading(true);
      try {
        const logs = await fetchLogs();
        if (!ignore) {
          setRawLogs(logs);
          const segments = transformLogsToSegments(logs);
          setData(segments);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to load sprint logs', err);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [activeSprint]);

  // ── Workflow Analysis ──────────────────────────────────────────
  const analyses = useMemo(() => {
    const all = analyzeAllTasks(rawLogs, notes);
    if (!activeSprint || activeSprint === 'auto') return all;
    
    const filtered: Record<string, typeof all[string]> = {};
    for (const [id, a] of Object.entries(all)) {
      if (String(a.sprint) === String(activeSprint)) {
        filtered[id] = a;
      }
    }
    return filtered;
  }, [rawLogs, notes, activeSprint]);
  
  const personSummaries = useMemo(() => getPersonSummaries(rawLogs, analyses), [rawLogs, analyses]);
  const allPersons = useMemo(
    () => Array.from(new Set(data.map((d) => d.person))).sort(),
    [data]
  );

  // ── Stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const taskList = Object.values(analyses);
    return {
      total: taskList.length,
      metGoal: taskList.filter((t) => t.sprintGoal && t.currentStatus === t.sprintGoal).length,
      bottlenecked: taskList.filter((t) => ['Waiting to Integrate', 'Reviewing', 'Reprocess'].includes(t.currentStatus)).length,
      doomLoops: taskList.filter((t) => t.doomLoopCount > 0).length,
      stale: taskList.filter((t) => t.isStale).length,
      highRisk: Array.from(highRiskIds).length,
    };
  }, [analyses, highRiskIds]);

  // ── Task Click from overview views ─────────────────────────────
  const handleTaskClick = (taskId: string) => {
    for (const lane of data) {
      for (const seg of lane.segments) {
        if (seg.taskId === taskId) {
          const latestSeg = lane.segments
            .filter((s) => s.taskId === taskId)
            .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];
          setSelectedSegment(latestSeg || seg);
          return;
        }
      }
    }
  };

  const currentAnalysis = selectedSegment ? analyses[selectedSegment.taskId] ?? null : null;
  const currentMeetingNotes = selectedSegment ? getNotesForTask(selectedSegment.taskId) : [];

  // ── Tab definitions ────────────────────────────────────────────
  const tabs: { key: ViewTab; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: 'dailyMeeting', label: 'Daily Meeting', icon: <UsersRound className="w-4 h-4" />, desc: 'Standup-ready view: Doing → Blocking → Blocked → Not Started' },
    { key: 'nextSprintPlanning', label: 'Squad Planner', icon: <Target className="w-4 h-4" />, desc: 'Draft and bulk sync tasks to the next sprint' },
    { key: 'dailyRecap', label: 'Daily Recap', icon: <History className="w-4 h-4" />, desc: 'Retrospective view of task movements per person' },
    { key: 'personnel', label: 'Personnel', icon: <LayoutGrid className="w-4 h-4" />, desc: 'Standup-ready view grouped by person' },
    { key: 'tasks', label: 'Tasks', icon: <ListChecks className="w-4 h-4" />, desc: 'Sortable task table with risk analysis' },
    { key: 'sprintStart', label: 'Sprint Start', icon: <Flag className="w-4 h-4" />, desc: 'Auto-detected starting status snapshot' },
    { key: 'sandbox', label: 'Sandbox', icon: <Code className="w-4 h-4" />, desc: 'Test integrations in isolation' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground p-3 sm:p-6 font-sans grid grid-rows-[auto_auto_1fr_auto] gap-4 transition-all duration-300">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-6">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-xl shadow-indigo-600/20 transform hover:scale-110 transition-transform">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
                Sprint Relay Debugger
                <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-md font-black shadow-lg shadow-indigo-500/20">V2.1.1-SYNCED</span>
                <div className="h-6 w-px bg-border mx-1" />
                <Link
                  href="/sandbox"
                  className="px-4 py-1.5 bg-secondary hover:bg-muted text-muted-foreground text-[10px] font-black rounded-full shadow-sm transition-all border border-border flex items-center gap-2 group"
                >
                  <Code className="w-3 h-3 group-hover:text-indigo-600 transition-colors" />
                  SANDBOX
                </Link>
              </h1>
              <p className="text-muted-foreground text-sm font-medium opacity-60">
                Advanced workflow diagnostics &mdash; bottleneck detection, doom loop tracking, and PM decision support.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap bg-secondary/30 p-1.5 rounded-xl border border-border/50">
          <div className="relative">
            <select
              value={manualOverride || 'auto'}
              onChange={(e) => saveManualOverride(e.target.value === 'auto' ? null : e.target.value)}
              className="bg-card border border-border text-foreground text-xs font-black uppercase tracking-widest rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none pr-10 shadow-sm"
            >
              <option value="auto">🌟 Auto-detect Current</option>
              {configs.map((s) => (
                <option key={s.number} value={s.number}>
                  Sprint {s.number}
                </option>
              ))}
            </select>
          </div>
          
          <Badge variant="outline" className="px-4 py-2.5 flex items-center gap-2 bg-indigo-50 border-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-800/50 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-sm">
            <Calendar className="w-3.5 h-3.5" />
            {activeSprint ? getSprintLabel(activeSprint).split('·')[1] : 'Loading...'}
          </Badge>

          <button
            type="button"
            onClick={() => setShowWebhookSettings(true)}
            className="px-4 py-2.5 flex items-center gap-2 bg-card border border-border rounded-xl text-foreground hover:bg-secondary font-black text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95"
            title="Configure per-person webhook URLs"
          >
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            {data.length} Members
          </button>

          <div className="h-4 w-px bg-border mx-1" />
          
          <DataManagementModal />
          
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-card rounded-xl border border-transparent hover:border-border transition-all active:scale-90"
            title="Sprint Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Stats Bar ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="px-4 py-3 bg-card border border-border rounded-xl flex flex-col shadow-sm hover:shadow-md transition-shadow group">
          <span className="text-muted-foreground text-[9px] uppercase tracking-widest font-black opacity-50 group-hover:opacity-100 transition-opacity">Total Tasks</span>
          <span className="text-3xl font-black font-mono text-foreground mt-2">{stats.total}</span>
        </div>
        <div className={`px-4 py-3 rounded-xl flex flex-col border shadow-sm transition-all hover:shadow-md ${stats.metGoal > 0 ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/50' : 'bg-card border-border'}`}>
          <span className="text-muted-foreground text-[9px] uppercase tracking-widest font-black flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Met Goal
          </span>
          <span className={`text-2xl font-black font-mono mt-1 ${stats.metGoal > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
            {stats.metGoal}
          </span>
        </div>
        <div className={`px-4 py-3 rounded-xl flex flex-col border shadow-sm transition-all hover:shadow-md ${stats.bottlenecked > 0 ? 'bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/50' : 'bg-card border-border'}`}>
          <span className="text-muted-foreground text-[9px] uppercase tracking-widest font-black flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-500 shadow-amber-500/20" /> Bottleneck
          </span>
          <span className={`text-2xl font-black font-mono mt-1 ${stats.bottlenecked > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
            {stats.bottlenecked}
          </span>
        </div>
        <div className={`px-4 py-3 rounded-xl flex flex-col border shadow-sm transition-all hover:shadow-md ${stats.doomLoops > 0 ? 'bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/50' : 'bg-card border-border'}`}>
          <span className="text-muted-foreground text-[9px] uppercase tracking-widest font-black flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 text-rose-500 animate-spin" style={{ animationDuration: '4s' }} /> Doom Loops
          </span>
          <span className={`text-2xl font-black font-mono mt-1 ${stats.doomLoops > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}`}>
            {stats.doomLoops}
          </span>
        </div>
        <div className={`px-4 py-3 rounded-xl flex flex-col border shadow-sm transition-all hover:shadow-md ${stats.stale > 0 ? 'bg-amber-50 border-amber-50 dark:bg-amber-950/10 dark:border-amber-900/20' : 'bg-card border-border'}`}>
          <span className="text-muted-foreground text-[9px] uppercase tracking-widest font-black">Stale (24h+)</span>
          <span className={`text-2xl font-black font-mono mt-1 ${stats.stale > 0 ? 'text-amber-700 dark:text-amber-200' : 'text-foreground'}`}>
            {stats.stale}
          </span>
        </div>
        <div className={`px-4 py-3 rounded-xl flex flex-col border shadow-sm transition-all hover:shadow-md ${stats.highRisk > 0 ? 'bg-indigo-50 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900/30' : 'bg-card border-border'}`}>
          <span className="text-muted-foreground text-[9px] uppercase tracking-widest font-black">📌 High Risk</span>
          <span className={`text-2xl font-black font-mono mt-1 ${stats.highRisk > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-foreground'}`}>
            {stats.highRisk}
          </span>
        </div>
      </div>

      {/* ── Main Content ───────────────────────────────────── */}
      <main className="w-full h-full flex flex-col gap-6">
        <div className="w-full">

          {/* Main Panel */}
          <Card className="w-full border-border bg-card/40 backdrop-blur-3xl shadow-2xl relative overflow-hidden group/main-card">
            {/* Subtle light effect */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <CardHeader className="p-0 border-b border-border/50">
              {/* Tab Navigation */}
              <div className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto custom-scrollbar-horizontal bg-secondary/20">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] uppercase tracking-widest font-black transition-all ${activeTab === tab.key
                      ? 'text-indigo-600 bg-background shadow-sm border border-border/40'
                      : 'text-muted-foreground/60 hover:text-foreground hover:bg-background/40'
                      }`}
                  >
                    <div className={activeTab === tab.key ? 'text-indigo-600' : 'text-muted-foreground/40'}>
                      {tab.icon}
                    </div>
                    <span>{tab.label}</span>
                    {activeTab === tab.key && (
                      <div className="absolute inset-x-4 -bottom-px h-0.5 bg-indigo-600 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
              <div className="px-6 py-2 bg-indigo-50/30 dark:bg-indigo-950/10 border-b border-border/30">
                <CardDescription className="text-[10px] font-black uppercase tracking-[0.1em] text-indigo-600 dark:text-indigo-400 opacity-70">
                  {tabs.find((t) => t.key === activeTab)?.desc}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {loading ? (
                <div className="w-full h-[500px] flex flex-col items-center justify-center border border-dashed border-border rounded-3xl bg-secondary/10 animate-pulse gap-4">
                  <div className="p-4 bg-muted rounded-2xl shadow-inner">
                    <Activity className="w-10 h-10 text-muted-foreground opacity-20 animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                  <p className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground/40">Synchronizing Telemetry...</p>
                </div>
              ) : (
                <div className="animate-in fade-in duration-700">
                  {activeTab === 'dailyMeeting' && (() => {
                    const snapshot = getSprintStartSnapshot(activeSprint || '', rawLogs);
                    const snapshotMap: Record<string, string> = {};
                    snapshot.forEach(entry => {
                      snapshotMap[entry.taskId] = entry.confirmedStatus;
                    });
                    return (
                      <DailyMeetingView
                        analyses={analyses}
                        meetingNotes={notes}
                        rawLogs={rawLogs}
                        sprintStartSnapshot={snapshotMap}
                        highRiskIds={highRiskIds}
                        onTaskClick={handleTaskClick}
                        activeSprint={activeSprint || ''}
                      />
                    );
                  })()}
                  {activeTab === 'nextSprintPlanning' && (
                    <NextSprintPlanningView
                      analyses={analyses}
                      rawLogs={rawLogs}
                      activeSprint={activeSprint || ''}
                      onTaskClick={handleTaskClick}
                    />
                  )}
                  {activeTab === 'dailyRecap' && (
                    <DailyRecapView
                      rawLogs={rawLogs}
                      sprintStartDate={configs.find(c => c.number === activeSprint)?.startDate}
                      onTaskClick={handleTaskClick}
                    />
                  )}
                  {activeTab === 'personnel' && (
                    <PersonnelOverview
                      summaries={personSummaries}
                      highRiskIds={highRiskIds}
                      onTaskClick={handleTaskClick}
                    />
                  )}
                  {activeTab === 'tasks' && (
                    <TaskOverview
                      analyses={analyses}
                      highRiskIds={highRiskIds}
                      onTaskClick={handleTaskClick}
                    />
                  )}
                  {activeTab === 'sprintStart' && (
                    <SprintStartManager
                      rawLogs={rawLogs}
                      selectedSprint={activeSprint || ''}
                      getSprintStartSnapshot={getSprintStartSnapshot}
                      onSaveOverride={saveOverride}
                      onBulkSaveOverrides={bulkSaveOverrides}
                      onClearOverride={clearOverride}
                      onClearAllOverrides={clearAllOverrides}
                      onConfirmAll={confirmAllAsOverrides}
                    />
                  )}
                  {activeTab === 'sandbox' && (
                    <div className="flex flex-col items-center justify-center py-16 bg-indigo-50/20 dark:bg-indigo-950/10 border border-dashed border-indigo-200 dark:border-indigo-900/40 rounded-xl animate-in zoom-in-95 duration-500 shadow-inner">
                      <div className="p-4 bg-white dark:bg-indigo-900/30 rounded-2xl shadow-xl mb-6 shadow-indigo-100 dark:shadow-indigo-950/40 relative">
                        <Code className="w-12 h-12 text-indigo-600" />
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-card animate-bounce shadow-lg shadow-emerald-500/20" />
                      </div>
                      <h3 className="text-xl font-black text-foreground mb-2 text-center">Sprint Movement Sandbox</h3>
                      <p className="text-muted-foreground text-xs font-medium mb-8 text-center max-w-sm opacity-70">
                        The isolated sandbox environment allows you to test webhook payloads and task movement logic without affecting production telemetry.
                      </p>
                      <Link 
                        href="/sandbox"
                        className="group relative flex items-center gap-3 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-2xl shadow-indigo-600/30 active:scale-95 border border-indigo-500/30"
                      >
                        <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                        Entry Point Alpha
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Modals & Overlays */}
      <WebhookSettingsModal
        isOpen={showWebhookSettings}
        onClose={() => setShowWebhookSettings(false)}
        persons={allPersons}
        activeSprint={activeSprint || ''}
      />

      <footer className="w-full flex items-center justify-between px-2 py-6 border-t border-border mt-8 bg-gradient-to-b from-transparent to-secondary/10">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-30">
          <Activity className="w-3.5 h-3.5" />
          Protocal active &middot; relay operational
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-muted-foreground/30 font-mono tracking-widest uppercase">Engine v2.1.0-rev4</span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40 animate-pulse" />
        </div>
      </footer>

      {/* Inspector Side Panel */}
      <StandupInspector
        segment={selectedSegment}
        taskAnalysis={currentAnalysis}
        onClose={() => setSelectedSegment(null)}
        isHighRisk={selectedSegment ? isHighRisk(selectedSegment.taskId) : false}
        onToggleHighRisk={toggleHighRisk}
        meetingNotes={currentMeetingNotes}
        onAddMeetingNote={addNote}
        onUpdateMeetingNote={updateNote}
        onDeleteMeetingNote={(id) => selectedSegment && deleteNote(selectedSegment.taskId, id)}
        allPersons={allPersons}
      />

      {/* Settings Modal */}
      <SprintSettings
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={refetchSprintConfig}
      />
    </div>
  );
}
