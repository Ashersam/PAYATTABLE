"use client";

export default function BillSummary({
  subtotal,
  discount,
  surcharge,
  taxes = [],
  total,
  symbol,
}) {
  const format = (value) =>
    Number(value || 0).toFixed(2);

  return (
    <div className="px-5 py-4 bg-white">

      {/* SUBTOTAL */}
      <div className="flex justify-between py-1 text-sm text-gray-600">
        <span>Subtotal</span>
        <span>
          {symbol}{format(subtotal)}
        </span>
      </div>

      {/* DISCOUNT */}
      {discount > 0 && (
        <div className="flex justify-between py-1 text-sm text-gray-600">
          <span>BILL DISC 10%</span>
          <span>
            -{symbol}{format(discount)}
          </span>
        </div>
      )}

      {/* SURCHARGE / BCRS */}
      {surcharge > 0 && (
        <div className="flex justify-between py-1 text-sm text-gray-600">
          <span>BCRS Dep</span>
          <span>
            {symbol}{format(surcharge)}
          </span>
        </div>
      )}

      {/* TAXES */}
      {taxes.map((tax, index) => (
        <div
          key={`${tax.name}-${index}`}
          className="flex justify-between py-1 text-sm text-gray-600"
        >
          <span>{tax.name}</span>

          <span>
            {symbol}{format(tax.amount)}
          </span>
        </div>
      ))}

      {/* DIVIDER */}
      <div className="border-t border-gray-300 my-2" />

      {/* TOTAL */}
      <div className="flex justify-between items-center pt-1">
        <span className="text-base font-bold text-gray-900">
          TOTAL
        </span>

        <span className="text-lg font-bold text-orange-600">
          {symbol}{format(total)}
        </span>
      </div>

    </div>
  );
}
// export default function BillSummary({
//     subtotal,
//     service,
//     gst,
//     convenience,
//     symbol,
//   }) {
//     const Row = ({ label, value, icon }) => (
//       <div className="flex justify-between items-center text-sm">
//         <div className="flex items-center gap-2 text-gray-600">
//           <span className="bg-gray-100 w-5 h-5 font-semibold text-gray-500 flex items-center justify-center rounded text-xs">
//             {icon}
//           </span>
//           {label}
//         </div>
//         <span>{symbol} {value}</span>
//       </div>
//     );
  
//     return (
//       <div className="bg-white  p-4 mt-3 text-gray-600 space-y-2 shadow-sm">
//         {/* <Row label="Service Charge" value={service} icon="$" /> */}
//         <Row label="GST" value={gst} icon="$" />
//         <Row label="Convenience Fee" value={convenience} icon="$" />
  
//         <div className="text-gray-600 pt-2 mt-2 flex justify-between font-semibold">
//           <span>Payable Total</span>
          
//           <span>{symbol} {subtotal}</span>
//         </div>
//         <p className="text-xs text-gray-500 mb-3">
//         Inclusive of tax and charges
//       </p>
//       </div>
//     );
//   }