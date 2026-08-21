"use client";

export default function HeaderCard({ tableId }) {
  return (
    <div className="text-center pt-6 pb-4">
      <div className="w-30 h-30 mx-auto rounded-xl bg-white shadow flex items-center justify-center">
        <img
          src="/logo.png"
          alt="logo"
          className="w-40 h-40 object-contain"
        />
      </div>

      <h2 className="text-lg font-semibold mt-3 text-gray-900">
        Table {tableId}
      </h2>

      <p className="text-xs text-gray-500">
        Scan • Pay • Go
      </p>
    </div>
  );
}