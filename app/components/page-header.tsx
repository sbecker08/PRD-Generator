import { type ReactNode } from "react";

type PageHeaderProps = {
  icon: ReactNode;
  iconBg?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export default function PageHeader({
  icon,
  iconBg = "bg-primary-600",
  title,
  subtitle,
  actions,
}: PageHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 shadow-sm flex-shrink-0">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shadow-sm flex-shrink-0`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900 leading-tight truncate">
              {title}
            </h1>
            {subtitle && (
              <div className="text-xs text-gray-500 leading-tight">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
