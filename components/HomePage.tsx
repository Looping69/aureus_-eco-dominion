import React from 'react';
import { ArrowUpRight, ChevronRight, Leaf, Mountain, Users, Play } from 'lucide-react';
import { ColonyLandscape } from './ColonyLandscape';
import './HomePage.css';

interface HomePageProps {
    onStartGame: () => void;
    onStartDemo: () => void;
    onContinueGame: () => void;
    hasSave: boolean;
    error?: string | null;
}

export const HomePage: React.FC<HomePageProps> = ({onStartGame,onStartDemo,onContinueGame,hasSave,error}) => (
    <div className="colony-home">
        <header className="colony-home-header">
            <a href="#colony-start" className="colony-brand" aria-label="Aureus Eco Dominion"><span className="colony-brand-mark"><Leaf size={22}/></span><span>AUREUS<span className="colony-brand-sub">ECO DOMINION</span></span></a>
            <span className="colony-edition">A colony. A living world.</span>
        </header>
        <main className="colony-home-main" id="colony-start">
            <section className="colony-welcome">
                <p className="colony-eyebrow"><span/> A WORLD WORTH BUILDING</p>
                <h1>Small beginnings.<br/><em>Lasting dominion.</em></h1>
                <p className="colony-description">Build a home on the frontier. Grow an industry, care for the land, and give your people a future.</p>
                <div className="colony-start-actions">
                    {hasSave ? <>
                        <button className="colony-start-primary" onClick={onContinueGame} type="button"><span>Continue colony<small>Return to the world you shaped</small></span><ArrowUpRight size={25}/></button>
                        <button className="colony-start-secondary" onClick={onStartGame} type="button">New colony <ChevronRight size={18}/></button>
                    </> : <button className="colony-start-primary" onClick={onStartGame} type="button"><span>Establish colony<small>Your story begins here</small></span><ArrowUpRight size={25}/></button>}
                    <button className="colony-demo" onClick={onStartDemo} type="button"><Play size={14}/> Guided demo <span>· 5 minutes</span></button>
                </div>
                {error && <p role="alert" className="colony-start-error">{error}</p>}
                <p className="colony-save-note">One settlement. Countless possibilities.</p>
            </section>
            <section className="colony-world-art" aria-label="Your future colony">
                <div className="colony-art-caption"><span>THE FRONTIER</span><span>01 — SETTLEMENT</span></div>
                <ColonyLandscape/>
                <div className="colony-art-footer"><span className="colony-art-rule"/><p>Prosperity takes root.</p><span className="colony-art-rule"/></div>
            </section>
        </main>
        <footer className="colony-home-footer">
            <div><Mountain size={19}/><span>Build with purpose<small>Shape your industry</small></span></div>
            <div><Leaf size={19}/><span>Keep the balance<small>Restore the land</small></span></div>
            <div><Users size={19}/><span>Grow together<small>Care for your colony</small></span></div>
            <span className="colony-signature">(|/) KLAASVAAKIE</span>
        </footer>
    </div>
);
