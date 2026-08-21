export default function PayBar({ total, symbol, onPay }) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">You pay</span>
          <span className="font-semibold">
            {symbol} {total}
          </span>
        </div>
  
        <button
          onClick={onPay}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-semibold shadow"
        >
          Pay full bill
        </button>
      </div>
    );
  }