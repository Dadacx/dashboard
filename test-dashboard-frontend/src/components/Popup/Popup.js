import { useState, useEffect, useRef } from "react";
import "./Popup.css";

let addPopupToQueue = () => { };
let closePopup = () => { };
const version = "1.2.3"

function PopupManager({ maxVisiblePopups = 1 }) {
  const [queue, setQueue] = useState([]);
  const [visiblePopups, setVisiblePopups] = useState([]);
  const [popupHeights, setPopupHeights] = useState({});
  const isProcessing = useRef(false);
  const popupRefs = useRef({});

  useEffect(() => {
    addPopupToQueue = (popupData) => {
      const id = Date.now() + Math.random();
      setQueue((prev) => [...prev, { ...popupData, id, visible: true }]);
    };

    closePopup = (id) => {
      if (id) {
        // Znajdź popup i clear timeout
        setVisiblePopups((prev) => {
          const popup = prev.find(p => p.id === id);
          if (popup && popup.timeoutId) {
            clearTimeout(popup.timeoutId);
          }
          return prev.map((p) =>
            p.id === id ? { ...p, visible: false } : p
          );
        });
        setTimeout(() => {
          setVisiblePopups((prev) => prev.filter((p) => p.id !== id));
        }, 300);
      } else {
        // Zamknij wszystkie
        setVisiblePopups((prev) => {
          prev.forEach(p => {
            if (p.timeoutId) clearTimeout(p.timeoutId);
          });
          return prev.map((p) => ({ ...p, visible: false }));
        });
        setTimeout(() => {
          setVisiblePopups([]);
        }, 300);
      }
    };
  }, []);

  useEffect(() => {
    if (isProcessing.current) return;

    if (queue.length > 0) {
      const next = queue[0];

      if (next.replace) {
        // Jeśli replace: true, zawsze nadpisz
        isProcessing.current = true;
        setVisiblePopups((prev) => {
          prev.forEach(p => {
            if (p.timeoutId) clearTimeout(p.timeoutId);
          });
          return prev.map((p) => ({ ...p, visible: false }));
        });
        setTimeout(() => {
          setVisiblePopups([next]);
          setQueue((prev) => prev.slice(1));
          isProcessing.current = false;
        }, 300);
      } else if (visiblePopups.length < maxVisiblePopups) {
        // Dodaj nowy popup, jeśli jest miejsce i nie ma replace
        isProcessing.current = true;
        setQueue((prev) => prev.slice(1));
        setVisiblePopups((prev) => [...prev, next]);
        setTimeout(() => { isProcessing.current = false; }, 0);
      }
      // Jeśli nie można dodać (miejsca zajęte i nie replace), zostaw w queue
    }
  }, [queue, visiblePopups, maxVisiblePopups]);

  useEffect(() => {
    visiblePopups.forEach((popup) => {
      if (!popup.timeoutId) {
        const timeoutId = setTimeout(() => {
          closePopup(popup.id);
        }, popup.duration || 3000);
        setVisiblePopups((prev) =>
          prev.map((p) =>
            p.id === popup.id ? { ...p, timeoutId } : p
          )
        );
      }
    });
  }, [visiblePopups]);

  const getIcon = (type) => {
    switch (type) {
      case "success":
        return (
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        );
      case "error":
        return (
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        );
      case "warning":
        return (
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        );
      case "info":
        return (
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        );
    }
  };

  const getPositionStyle = (position, index, popupId) => {
    const base = 10;
    const gap = 10; // Gap między popupami
    let offset = 0;
    
    // Oblicz offset na podstawie wysokości poprzednich popupów
    const visiblePopupsForPosition = visiblePopups.filter(p => p.position === position);
    for (let i = 0; i < index; i++) {
      const prevPopup = visiblePopupsForPosition[i];
      offset += (popupHeights[prevPopup.id] || 60) + gap;
    }
    
    switch (position) {
      case 'bottomLeft':
        return { bottom: `${base + offset}px`, left: `${base}px` };
      case 'bottom':
        return { bottom: `${base + offset}px`, left: '50%' };
      case 'bottomRight':
        return { bottom: `${base + offset}px`, right: `${base}px` };
      case 'topLeft':
        return { top: `${base + offset}px`, left: `${base}px` };
      case 'top':
        return { top: `${base + offset}px`, left: '50%' };
      case 'topRight':
        return { top: `${base + offset}px`, right: `${base}px` };
      case 'left':
        const leftOffset = (index - 1) + offset;
        return { left: `${base}px`, top: `calc(40% + ${leftOffset}px)` };
      case 'right':
        const rightOffset = (index - 1) + offset;
        return { right: `${base}px`, top: `calc(40% + ${rightOffset}px)` };
      default:
        return { bottom: `${base + offset}px`, left: `${base}px` };
    }
  };

  const positionCounts = {};
  const popupsWithIndex = visiblePopups.map(popup => {
    const perIndex = positionCounts[popup.position] || 0;
    positionCounts[popup.position] = perIndex + 1;
    return { ...popup, perIndex };
  });

  // Mierz wysokości popupów
  useEffect(() => {
    const newHeights = {};
    popupsWithIndex.forEach(popup => {
      const el = popupRefs.current[popup.id];
      if (el) {
        newHeights[popup.id] = el.offsetHeight;
      }
    });
    
    // Aktualizuj tylko jeśli coś się zmieniło
    if (JSON.stringify(newHeights) !== JSON.stringify(popupHeights)) {
      setPopupHeights(newHeights);
    }
  }, [popupsWithIndex]);
  return (
    <>
      {popupsWithIndex.map((popup, globalIndex) => (
        <div
          key={popup.id}
          ref={el => popupRefs.current[popup.id] = el}
          style={{ ...popup.style, ...getPositionStyle(popup.position, popup.perIndex, popup.id) }}
          onClick={popup.onClick}
          className={`popup ${popup.visible ? "show" : "hide"} ${popup.type} ${popup.position} ${popup.border ? "border" : ""} index-${popup.perIndex}`}
        >
          {popup.icon && <span className="popup-icon">{getIcon(popup.type)}</span>}
          <span className="popup-message">{popup.message}</span>
          <button className="close-btn" onClick={(e) => { e.stopPropagation(); closePopup(popup.id); }}>×</button>
        </div>
      ))}
    </>
  );
}

// Użycie: showPopup({ message: "Treść", type: "error", duration: 5000, position: "top", style: { backgroundColor: 'red' }, border: true, icon: true, replace: true, onClick: () => console.log("Clicked") });
function showPopup({ message, type = "default", duration = 3000, position = "bottomLeft", style = {}, border = false, icon = false, replace = false, onClick = () => { } }) {
  addPopupToQueue({ message, type, duration, position, style, border, icon, replace, onClick });
}

export { PopupManager, showPopup, closePopup, version };