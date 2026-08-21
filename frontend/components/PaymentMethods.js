"use client";

export default function PaymentMethods({ selected, setSelected }) {
  const methods = [
    { id: "apple", label: "Apple Pay" },
    { id: "paynow", label: "PayNow" },
    { id: "card", label: "Card" },
  ];

  return (
    <div className="space-y-3 mt-4">
      <h3 className="text-sm font-semibold text-gray-600">Payment Method</h3>

      {methods.map((m) => (
        <div
          key={m.id}
          onClick={() => setSelected(m.id)}
          className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center 
          ${selected === m.id ? "border-purple-600 bg-purple-50" : "border-gray-200"}`}
        >
          <span>{m.label}</span>
          {selected === m.id && <span>✔</span>}
        </div>
      ))}
    </div>
  );
}