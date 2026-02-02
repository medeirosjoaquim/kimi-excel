import { useEffect } from "react";
import { Coins, RefreshCw, AlertCircle } from "lucide-react";
import { useUsageStore } from "../../stores/useUsageStore.js";

export function UsageStatusline() {
  const balance = useUsageStore((s) => s.balance);
  const isLoading = useUsageStore((s) => s.isLoading);
  const error = useUsageStore((s) => s.error);
  const fetchBalance = useUsageStore((s) => s.fetchBalance);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const formatBalance = (value: number): string => {
    // Balance is typically in yuan/dollars with decimal places
    return `¥${value.toFixed(2)}`;
  };

  const handleRefresh = () => {
    // Force refresh by clearing last fetched time
    useUsageStore.setState({ lastFetched: null });
    fetchBalance();
  };

  if (error) {
    return (
      <div className="usage-statusline usage-statusline-error">
        <AlertCircle size={14} />
        <span>Balance unavailable</span>
      </div>
    );
  }

  return (
    <div className="usage-statusline">
      <div className="usage-statusline-item">
        <Coins size={14} />
        <span className="usage-label">Balance:</span>
        {isLoading ? (
          <span className="usage-value usage-loading">...</span>
        ) : balance ? (
          <span className="usage-value">{formatBalance(balance.available_balance)}</span>
        ) : (
          <span className="usage-value usage-placeholder">--</span>
        )}
      </div>

      {balance && balance.voucher_balance > 0 && (
        <div className="usage-statusline-item usage-voucher">
          <span className="usage-label">Voucher:</span>
          <span className="usage-value">{formatBalance(balance.voucher_balance)}</span>
        </div>
      )}

      <button
        className="usage-refresh"
        onClick={handleRefresh}
        disabled={isLoading}
        title="Refresh balance"
        aria-label="Refresh balance"
      >
        <RefreshCw size={12} className={isLoading ? "spinning" : ""} />
      </button>
    </div>
  );
}
