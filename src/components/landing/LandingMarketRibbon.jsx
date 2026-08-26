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
  if (market.id === "de") {
    return (
      <div className="landing-market-ribbon landing-market-ribbon--de" role="status">
        <span className="landing-market-ribbon__pulse" aria-hidden />
        <span>{market.flag} Deutschland</span>
        <span className="landing-market-ribbon__sep">·</span>
        <span>EUR · Beta</span>
        <span className="landing-market-ribbon__sep">·</span>
        <span>Österreich und Schweiz live</span>
      </div>
    );
  }
  if (market.id === "at") {
    return (
      <div className="landing-market-ribbon landing-market-ribbon--de" role="status">
        <span className="landing-market-ribbon__pulse" aria-hidden />
        <span>{market.flag} Österreich</span>
        <span className="landing-market-ribbon__sep">·</span>
        <span>EUR · BauKG · Beta</span>
        <span className="landing-market-ribbon__sep">·</span>
        <span>AUVA</span>
      </div>
    );
  }
  if (market.id === "ch") {
    return (
      <div className="landing-market-ribbon landing-market-ribbon--de" role="status">
        <span className="landing-market-ribbon__pulse" aria-hidden />
        <span>{market.flag} Schweiz</span>
        <span className="landing-market-ribbon__sep">·</span>
        <span>CHF · BauAV · Beta</span>
        <span className="landing-market-ribbon__sep">·</span>
        <span>Suva</span>
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
