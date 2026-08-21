export default function BillItems({ items, symbol }) {
    return (
      <div className="bg-white  shadow-sm p-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between items-center">
  
            {/* LEFT SIDE */}
            <div className="flex gap-3 items-center">
              <div className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {item.quantity}x
              </div>
  
              <span className="text-sm text-gray-800">
                {item.name}
              </span>
            </div>
  
            {/* RIGHT SIDE */}
            <span className="text-sm font-medium text-gray-900">
              {symbol} {item.price}
            </span>
          </div>
        ))}
      </div>
    );
  }