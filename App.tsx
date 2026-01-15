import React, { useState, useRef, useEffect, useCallback } from 'react';
import { STAFF_LIST, TIME_SLOTS, WORK_ITEMS } from './constants';
import { Staff } from './types';

const App: React.FC = () => {
  const [staffRows, setStaffRows] = useState<Staff[]>(STAFF_LIST.filter(s => s.tag !== 'ADD'));
  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<Record<string, { workId: string; confirmed: boolean }>>({}); 
  const [history, setHistory] = useState<Record<string, { workId: string; confirmed: boolean }>[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [animatingKey, setAnimatingKey] = useState<string | null>(null);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [activeStaffTarget, setActiveStaffTarget] = useState<string | null>(null);
  
  const longPressTimer = useRef<number | null>(null);
  const dragStarted = useRef(false);
  const hasJustApplied = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const getCellKey = (staffId: string, timeIdx: number) => `${staffId}-${timeIdx}`;
  const FULL_TIME_SLOTS = Array.from({ length: 24 }, (_, i) => `${i}~${i + 1}`);

  useEffect(() => {
    if (scrollContainerRef.current) {
      const cellWidth = 64; 
      const scrollOffset = 8 * cellWidth;
      scrollContainerRef.current.scrollLeft = scrollOffset;
    }
  }, []);

  useEffect(() => {
    if (selectedCells.length === 0 && !isDragging) {
      setIsPanelOpen(false);
    }
  }, [selectedCells, isDragging]);

  const handleCellSelection = useCallback((staffId: string, timeIdx: number) => {
    const key = getCellKey(staffId, timeIdx);
    const staff = staffRows.find(s => s.id === staffId);
    
    if (staff && (!staff.name || staff.name.trim() === "")) {
      setActiveStaffTarget(staffId);
      setIsStaffModalOpen(true);
      return;
    }

    setSelectedCells(prev => {
      if (prev.includes(key) && prev.length === 1) {
        return [];
      }
      if (hasJustApplied.current) {
        hasJustApplied.current = false;
        setIsPanelOpen(true);
        return [key];
      }
      setIsPanelOpen(true);
      return prev.includes(key) ? prev : [...prev, key];
    });
  }, [staffRows]);

  const startDragging = useCallback((staffId: string, timeIdx: number) => {
    const staff = staffRows.find(s => s.id === staffId);
    if (staff && (!staff.name || staff.name.trim() === "")) return;

    const key = getCellKey(staffId, timeIdx);
    setIsDragging(true);
    dragStarted.current = true;
    setAnimatingKey(key);
    setTimeout(() => setAnimatingKey(null), 400);
    
    setSelectedCells(prev => {
      if (hasJustApplied.current) {
        hasJustApplied.current = false;
        return [key];
      }
      return prev.includes(key) ? prev : [...prev, key];
    });
    setIsPanelOpen(true);
  }, [staffRows]);

  const handleMouseDown = (staffId: string, timeIdx: number) => {
    longPressTimer.current = window.setTimeout(() => startDragging(staffId, timeIdx), 300);
  };

  const handleMouseEnter = (staffId: string, timeIdx: number) => {
    if (!isDragging) return;
    const key = getCellKey(staffId, timeIdx);
    setSelectedCells(prev => prev.includes(key) ? prev : [...prev, key]);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsDragging(false);
  };

  const handleTouchStart = (staffId: string, timeIdx: number) => {
    dragStarted.current = false;
    longPressTimer.current = window.setTimeout(() => startDragging(staffId, timeIdx), 300);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const cellKey = element?.closest('td')?.getAttribute('data-cell-key');
    if (cellKey) {
      setSelectedCells(prev => prev.includes(cellKey) ? prev : [...prev, cellKey]);
    }
  };

  const applyWork = (workId: string | null) => {
    setHistory(prev => [...prev, { ...schedule }]);
    const newSchedule = { ...schedule };
    selectedCells.forEach(key => {
      if (workId === null) {
        delete newSchedule[key];
      } else {
        newSchedule[key] = { workId, confirmed: false };
      }
    });
    setSchedule(newSchedule);
    hasJustApplied.current = true;
  };

  const confirmAllShifts = () => {
    setHistory(prev => [...prev, { ...schedule }]);
    const newSchedule = { ...schedule };
    Object.keys(newSchedule).forEach(key => {
      newSchedule[key] = { ...newSchedule[key], confirmed: true };
    });
    setSchedule(newSchedule);
    setSelectedCells([]);
    setIsPanelOpen(false);
  };

  const undoAction = () => {
    if (history.length === 0) return;
    setSchedule(history[history.length - 1]);
    setHistory(prev => prev.slice(0, -1));
  };

  const addNewRow = () => {
    const newId = `new-${Date.now()}`;
    setStaffRows(prev => [...prev, { id: newId, name: '', avatar: '', tag: '' }]);
  };

  const assignStaffToRow = (newStaffData: Partial<Staff>) => {
    if (!activeStaffTarget) return;
    setStaffRows(prev => prev.map(s => s.id === activeStaffTarget ? { ...s, ...newStaffData } : s));
    setIsStaffModalOpen(false);
    setActiveStaffTarget(null);
  };

  const totalRevenue = FULL_TIME_SLOTS.length * 400; 
  const scheduleEntries = Object.entries(schedule);
  const scheduledStaffIds = new Set<string>();
  const unconfirmedStaffIds = new Set<string>();
  let totalHours = 0;

  scheduleEntries.forEach(([key, val]) => {
    const entry = val as { workId: string; confirmed: boolean };
    const staffId = key.split('-')[0];
    const staff = staffRows.find(s => s.id === staffId);
    if (entry && entry.workId && staff && staff.name && staff.name.trim() !== "") {
      scheduledStaffIds.add(staffId);
      totalHours += 1;
      if (!entry.confirmed) unconfirmedStaffIds.add(staffId);
    }
  });

  const efficiency = totalHours > 0 ? Math.round(totalRevenue / totalHours) : null;
  const unconfirmedStaffCount = unconfirmedStaffIds.size;

  return (
    <div 
      id="app-container" 
      className={isDragging ? 'is-dragging' : ''}
      onMouseUp={handleMouseUp} 
      onTouchEnd={handleMouseUp}
      onTouchMove={handleTouchMove}
    >
      <div className="bg-white z-[60] shadow-sm flex-none">
        <div className="px-6 pt-4 flex justify-between items-center text-xs font-bold">
          <span>9:41</span>
          <div className="flex space-x-1 items-center">
            <i className="fas fa-signal"></i>
            <i className="fas fa-wifi"></i>
            <i className="fas fa-battery-full text-lg"></i>
          </div>
        </div>
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <i className="fas fa-chevron-left text-xl text-gray-800"></i>
            <div>
              <h1 className="text-lg font-bold text-gray-900">青团咖啡金之源店</h1>
              <div className="flex items-center text-xs text-gray-500">
                <span>青团咖啡</span><i className="fas fa-caret-down ml-1"></i>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="bg-gray-100 px-3 py-1 rounded-full text-sm font-medium flex items-center">
              <span className="text-gray-900">日</span>
              <span className="text-[10px] ml-1 text-gray-400">周</span>
            </div>
            <i className="fas fa-ellipsis-h text-gray-600"></i>
            <div className="w-8 h-8 rounded-full border-2 border-gray-900 p-0.5">
              <div className="w-full h-full rounded-full bg-black"></div>
            </div>
          </div>
        </div>
        
        <div className="px-4 py-3 flex justify-between items-end border-b border-gray-100">
          <div className="text-center pr-4">
            <div className="text-[10px] text-gray-400 font-medium leading-none">2025</div>
            <div className="text-lg font-bold flex items-center mt-1">4月<i className="fas fa-caret-down text-[10px] ml-1"></i></div>
          </div>
          {[{ label: '一', d: 28 }, { label: '二', d: '今' }, { label: '三', d: 30 }, { label: '四', d: 1 }, { label: '五', d: 2 }, { label: '六', d: 3, active: true }, { label: '日', d: 4 }].map((item, i) => (
            <div key={i} className="text-center flex flex-col items-center">
              <span className="text-[10px] mb-1 font-bold text-gray-400 uppercase">{item.label}</span>
              <div className={`w-9 h-9 flex items-center justify-center rounded-full font-bold text-sm transition-all ${item.active ? 'bg-gray-800 text-white shadow-md' : 'text-gray-700 active:bg-gray-100'}`}>
                {item.d}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-auto custom-scrollbar relative bg-white">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="bg-white text-[10px] text-[#595D6A]">
              <th className="sticky left-0 top-0 bg-white z-[55] p-0 border border-gray-100 w-[70px]">
                <div className="h-6 flex items-center pl-2 space-x-1 text-emerald-600"><i className="fas fa-yen-sign"></i><span>预估流水</span></div>
                <div className="border-t border-gray-100 w-full"></div>
                <div className="h-6 flex items-center pl-2 space-x-1 text-gray-400 font-medium"><i className="far fa-clock"></i><span>时间</span></div>
              </th>
              {FULL_TIME_SLOTS.map((slot, i) => (
                <th key={i} className="sticky top-0 bg-white p-0 border border-gray-100 min-w-[64px] z-30">
                  <div className="h-6 flex items-center justify-center text-emerald-500 font-bold">400</div>
                  <div className="border-t border-gray-100 w-full"></div>
                  <div className="h-6 flex items-center justify-center font-medium text-gray-500">{slot}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staffRows.map((staff) => {
              const isEmptyStaff = !staff.name || staff.name.trim() === "";
              const hasUnconfirmedInRow = unconfirmedStaffIds.has(staff.id);
              return (
                <tr key={staff.id}>
                  <td className="sticky left-0 bg-white z-[45] border border-gray-100 p-0 text-center relative h-[78px]">
                    <div className="flex flex-col items-center justify-center h-full relative" onClick={() => { setActiveStaffTarget(staff.id); setIsStaffModalOpen(true); }}>
                      {hasUnconfirmedInRow && <div className="pending-tag">待确认</div>}
                      {isEmptyStaff ? (
                        <div className="w-11 h-11 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300">
                          <i className="fas fa-user-plus"></i>
                        </div>
                      ) : (
                        <div className="relative mt-1">
                          <img src={staff.avatar} className="w-11 h-11 rounded-full object-cover shadow-sm border border-gray-100" />
                          {staff.tag && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-emerald-600 text-[8px] text-white px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">{staff.tag}</span>}
                        </div>
                      )}
                      <span className={`text-[11px] font-bold mt-1.5 ${isEmptyStaff ? 'text-gray-300' : 'text-gray-800'}`}>
                        {staff.name || '添加人员'}
                      </span>
                    </div>
                  </td>
                  {FULL_TIME_SLOTS.map((_, tIdx) => {
                    const key = getCellKey(staff.id, tIdx);
                    const isSelected = selectedCells.includes(key);
                    const entry = schedule[key];
                    const work = entry ? WORK_ITEMS.find(w => w.id === entry.workId) : null;
                    const showUnconfirmedUI = work && !entry.confirmed;
                    
                    return (
                      <td 
                        key={tIdx} 
                        data-cell-key={key}
                        className={`border border-gray-100 relative transition-colors h-[78px]
                          ${work ? `${work.color} z-10` : 'bg-white'} 
                          ${isSelected ? 'grid-cell-selected' : ''} 
                          ${showUnconfirmedUI ? 'unconfirmed-pattern unconfirmed-border' : ''}`}
                        onMouseDown={() => handleMouseDown(staff.id, tIdx)}
                        onMouseEnter={() => handleMouseEnter(staff.id, tIdx)}
                        onTouchStart={() => handleTouchStart(staff.id, tIdx)}
                        onClick={() => handleCellSelection(staff.id, tIdx)}
                      >
                        {isSelected && <div className={`selection-overlay ${animatingKey === key ? 'animate-pulse-selection' : ''}`} />}
                        {work && (
                          <div className={`absolute inset-0 flex items-center justify-center text-[13px] font-bold z-20 pointer-events-none 
                            ${showUnconfirmedUI ? `text-unconfirmed-${work.color.split('-')[1]}` : 'text-gray-700'}`}>
                            {work.label}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr>
              <td colSpan={FULL_TIME_SLOTS.length + 1} className="p-8 flex justify-center bg-gray-50/20">
                <button onClick={addNewRow} className="flex items-center space-x-2 text-gray-400 font-bold py-3 px-8 border-2 border-dashed border-gray-200 rounded-2xl active:bg-gray-100 active:scale-95 transition-all">
                  <i className="fas fa-plus"></i><span>新增人员行</span>
                </button>
              </td>
            </tr>
            <tr><td colSpan={FULL_TIME_SLOTS.length + 1} className="h-40"></td></tr>
          </tbody>
        </table>
      </div>

      <div className="fixed bottom-0 left-0 right-0 flex flex-col pointer-events-none z-[100]">
        <div className="flex gap-4 items-center justify-center py-4 px-4 pointer-events-auto">
          {[{ icon: 'fa-undo', action: undoAction }, { icon: 'fa-list-ul' }, { icon: 'fa-search' }, { icon: 'fa-clock', label: '1h' }, { icon: 'fa-cog' }, { icon: 'fa-plus', action: addNewRow }].map((btn, i) => (
            <div key={i} onClick={() => btn.action?.()} className="w-12 h-12 rounded-full border border-gray-100 bg-white shadow-xl flex items-center justify-center text-gray-700 active:scale-90 transition-transform backdrop-blur-md bg-white/90">
              {btn.label ? <div className="flex flex-col items-center"><span className="font-bold text-[10px] mb-0.5">{btn.label}</span><div className="w-3 h-0.5 bg-black rounded"></div></div> : <i className={`fas ${btn.icon} text-base`}></i>}
            </div>
          ))}
        </div>

        <div className={`overflow-hidden transition-all duration-300 pointer-events-auto shadow-[0_-8px_30px_rgb(0,0,0,0.08)] ${isPanelOpen ? 'max-h-[500px]' : 'max-h-0'}`}>
          <div className="bg-white px-4 pb-6 border-t border-gray-100 rounded-t-[32px]">
             <div className="flex justify-between items-center py-4 px-2">
               <i className="fas fa-chevron-down text-gray-300 p-2 text-lg active:scale-75 transition-transform" onClick={() => { setIsPanelOpen(false); setSelectedCells([]); }}></i>
               <div className="flex bg-gray-100 rounded-full p-1 w-44">
                 <div className="flex-1 text-center py-1.5 rounded-full bg-white text-[11px] font-bold shadow-sm text-gray-800">工作内容</div>
                 <div className="flex-1 text-center py-1.5 text-[11px] font-bold text-gray-400">班次</div>
               </div>
               <i className="far fa-edit text-gray-500 p-2 text-lg"></i>
             </div>
             <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1 border-2 border-dashed border-gray-100 rounded-2xl h-14 flex items-center justify-center text-gray-200"><i className="fas fa-plus text-xl"></i></div>
                <div onClick={() => applyWork(null)} className="col-span-1 bg-gray-50 rounded-2xl h-14 flex items-center justify-center text-gray-600 text-sm font-bold space-x-1 active:bg-gray-100"><i className="fas fa-eraser"></i><span>清除</span></div>
                {WORK_ITEMS.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => applyWork(item.id)} 
                    className={`flex items-center justify-center rounded-2xl h-14 text-[14px] font-bold ${item.color} ${item.color.replace('bg-', 'text-')} active:scale-95 transition-transform shadow-sm`}
                  >
                    {item.label}
                  </div>
                ))}
             </div>
          </div>
        </div>

        <div className="h-[84px] bg-[#F4F5F6] border-t border-gray-200 px-5 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center">
             <div className={`w-14 h-14 rounded-full border-[5px] transition-colors duration-500 ${efficiency ? 'border-emerald-500' : 'border-gray-200'} flex flex-col items-center justify-center bg-white shadow-sm`}>
                <span className={`text-xl font-bold leading-tight ${efficiency ? 'text-gray-900' : 'text-gray-300'}`}>{efficiency || '--'}</span>
                <span className="text-[8px] text-gray-400 font-bold">人效</span>
             </div>
             <div className="w-[1px] h-10 bg-gray-200 mx-5"></div>
             <div className="text-sm">
                <div className="flex items-center space-x-2"><span className="text-gray-400 font-medium">已排:</span><span className="font-bold text-gray-900">{scheduledStaffIds.size}人</span></div>
                <div className="flex items-center space-x-2 mt-0.5"><span className="text-gray-400 font-medium">工时:</span><span className="font-bold text-gray-900">{totalHours}h</span></div>
             </div>
          </div>
          <div className="flex items-center space-x-4">
            {unconfirmedStaffCount > 0 ? (
              <div className="flex flex-col items-end">
                <span className="text-orange-500 text-[11px] font-bold mb-1">{unconfirmedStaffCount} 个待确认</span>
                <button 
                  onClick={confirmAllShifts} 
                  className="bg-[#19C1AD] text-white px-8 py-3 rounded-2xl font-bold text-base shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                >
                  确认排班
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center text-gray-400 group active:scale-95 transition-transform">
                <div className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center mb-1 bg-white">
                  <i className="far fa-copy text-xl"></i>
                </div>
                <span className="text-[9px] font-bold">复用上周六</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {isStaffModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-md p-4" onClick={() => setIsStaffModalOpen(false)}>
          <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden p-8 animate-in slide-in-from-bottom-8 duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">选择排班人员</h3>
              <i className="fas fa-times text-gray-300 text-xl" onClick={() => setIsStaffModalOpen(false)}></i>
            </div>
            <div className="grid grid-cols-3 gap-6">
              {[
                { name: '王嘉尔', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=faces', tag: '店长' },
                { name: '肖战', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces', tag: '全职' },
                { name: '迪丽热巴', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=faces', tag: '兼职' },
                { name: '周杰伦', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&crop=faces', tag: '自有员工' },
                { name: '易烊千玺', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces', tag: '自有员工' },
                { name: '林青霞', avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&h=200&fit=crop&crop=faces', tag: '代班' }
              ].map((p, i) => (
                <div key={i} onClick={() => assignStaffToRow(p)} className="flex flex-col items-center p-3 rounded-3xl active:bg-gray-50 transition-all cursor-pointer group">
                  <div className="relative mb-2">
                    <img src={p.avatar} className="w-16 h-16 rounded-full object-cover shadow-sm group-active:scale-90 transition-transform" />
                    <div className="absolute inset-0 rounded-full border-2 border-transparent group-hover:border-emerald-400 transition-colors"></div>
                  </div>
                  <span className="text-[13px] font-bold text-gray-800 text-center truncate w-full">{p.name}</span>
                  <span className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{p.tag}</span>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setIsStaffModalOpen(false)} 
              className="w-full mt-8 py-4 bg-gray-100 rounded-2xl font-bold text-gray-600 active:bg-gray-200 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;