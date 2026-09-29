import { useRouter } from "next/router";
import { Shell } from "@/components/Shell";
import { creatures, ponds } from "@/lib/mock";

export default function CreaturePage() {
  const router = useRouter();
  const id = String(router.query.id ?? "");
  const creature = creatures.find((c) => c.mint === id) ?? creatures[0];
  const pond = ponds.find((p) => p.mint === creature.pondMint);

  return (
    <Shell>
      <main className="page">
        <div className="creature-room">
          <div className="room-scene">
            <span className="room-label">{"POND / " + (pond?.symbol ?? "?")}</span>
            <div className="big-sprite">{creature.species === "frog" ? "●" : creature.species === "fish" ? "◆" : "⬡"}</div>
            <h1>{"$" + creature.symbol}</h1>
            <p>{"living in $" + (pond?.symbol ?? "?")}</p>
          </div>
          <div className="room-data">
            <div><small>MARKET CAP</small><strong>{"$" + creature.marketCapUsd.toLocaleString()}</strong></div>
            <div><small>24H VOLUME</small><strong>{"$" + creature.volume24hUsd.toLocaleString()}</strong></div>
            <div><small>WATER / QUOTE RESERVE</small><strong>{creature.quoteReserve.toLocaleString()} {pond?.symbol}</strong></div>
            <div><small>GRADUATION</small><strong>{Math.round(creature.graduationProgress * 100)}%</strong></div>
            <div className="meter"><span style={{ width: String(creature.graduationProgress * 100) + "%" }} /></div>
            <p>real DBC state will replace this mock snapshot in the chain-integration chunk.</p>
          </div>
        </div>
      </main>
    </Shell>
  );
}
