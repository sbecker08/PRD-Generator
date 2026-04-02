"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export default function NewRequestButton() {
  const router = useRouter();

  const handleClick = () => {
    const id = crypto.randomUUID();
    router.push(`/${id}?new=1`);
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 text-sm bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
    >
      <Plus size={14} />
      New Request
    </button>
  );
}
