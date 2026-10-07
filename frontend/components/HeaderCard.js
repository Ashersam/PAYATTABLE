"use client";

export default function HeaderCard({
  tableId,
  receiptNo,
  operatorName,
  openDate,
}) {

  return (
    <div className="px-5 pt-6 pb-5">
      {/* Logo */}
      <div className="flex justify-center">
        <div className="w-24 h-24 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
          <img
            src="/logo.png"
            alt="Restaurant logo"
            className="w-20 h-20 object-contain"
          />
        </div>
      </div>

      {/* Table */}
      <div className="text-center mt-4">
        <h2 className="text-[21px] font-semibold tracking-tight text-gray-900">
          Table {tableId}
        </h2>

        <p className="mt-1 text-[11px] font-medium tracking-[0.18em] uppercase text-gray-400">
          Scan • Pay • Go
        </p>
      </div>

      {/* Order Information */}
      <div className="mt-5 rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3.5">
        {/* Receipt + Operator */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-gray-400">
              Receipt
            </p>

            <p className="mt-0.5 text-xs font-medium text-gray-800 truncate">
              {receiptNo || "-"}
            </p>
          </div>

          <div className="h-8 w-px bg-gray-200" />

          <div className="min-w-0 text-right">
            <p className="text-[10px] uppercase tracking-wider text-gray-400">
              Operator
            </p>

            <p className="mt-0.5 text-xs font-medium text-gray-800 truncate">
              {operatorName || "-"}
            </p>
          </div>
        </div>

        {/* Order Date */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">
            Order Date
          </p>

          <p className="mt-0.5 text-xs font-medium text-gray-700">
            {openDate || "-"}
          </p>
        </div>
      </div>
    </div>
  );
}