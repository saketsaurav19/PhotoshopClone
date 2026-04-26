import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface ToolButtonProps {
  id: string;
  active: boolean;
  icon: LucideIcon;
  label: string;
  shortcut: string;
  onClick: () => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({ active, icon: Icon, label, shortcut, onClick }) => {
  return (
    <button
      className={`tool-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      title={`${label} (${shortcut.toUpperCase()})`}
    >
      <Icon size={20} />
    </button>
  );
};

export default ToolButton;
