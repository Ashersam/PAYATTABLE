export default function BillSummary({
    subtotal,
    service,
    gst,
    convenience,
    symbol,
  }) {
    const Row = ({ label, value, icon }) => (
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <span className="bg-gray-100 w-5 h-5 font-semibold text-gray-500 flex items-center justify-center rounded text-xs">
            {icon}
          </span>
          {label}
        </div>
        <span>{symbol} {value}</span>
      </div>
    );
  
    return (
      <div className="bg-white  p-4 mt-3 text-gray-600 space-y-2 shadow-sm">
        {/* <Row label="Service Charge" value={service} icon="$" /> */}
        <Row label="GST" value={gst} icon="$" />
        <Row label="Convenience Fee" value={convenience} icon="$" />
  
        <div className="text-gray-600 pt-2 mt-2 flex justify-between font-semibold">
          <span>Payable Total</span>
          
          <span>{symbol} {subtotal}</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">
        Inclusive of tax and charges
      </p>
      </div>
    );
  }