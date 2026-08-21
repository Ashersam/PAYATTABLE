function ProcessingScreen() {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-500 to-blue-400 flex items-center justify-center z-50">
  
        <div className="bg-white rounded-3xl p-8 shadow-xl text-center w-[300px]">
  
          {/* Spinner */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
  
          <h2 className="text-lg font-semibold text-gray-800">
            Processing Payment
          </h2>
  
          <p className="text-sm text-gray-500 mt-2">
            Please wait while we confirm your payment...
          </p>
  
        </div>
      </div>
    );
  }

 export default ProcessingScreen;