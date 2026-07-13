/** @param {{ market: import("../../config/markets").MarketConfig }} props */
export default function LandingMarketRibbon({ market }) {
  if (market.id === "pl") {
    return (
      <div className="landing-market-ribbon landing-market-ribbon--pl" role="status">
        <span className="landing-market-ribbon__pulse" aria-hidden />
        <span>{market.flag} Polska</span>
        <span className="landing-market-ribbon__sep">·</span>
        <span>Płatności PLN live</span>
        <span className="landing-market-ribbon__sep">·</span>
        <span className="landing-market-ribbon__beta">Beta</span>
      </div>
    );
  }
  if (market.id === "au") {
    return (
      <div className="landing-market-ribbon landing-market-ribbon--au" role="status">
        <span className="landing-market-ribbon__pulse" aria-hidden />
        <span>{market.flag} Australia</span>
        <span className="landing-market-ribbon__sep">·</span>
        <span>AUD billing live</span>
      </div>
    );
  }
  return null;
}
