export const getSymbol = (currency) => {
    switch (currency) {
      case "INR": return "₹";
      case "USD": return "$";
      case "SGD": return "$";
      case "EUR": return "€";
      default: return "SGD";
    }
  };