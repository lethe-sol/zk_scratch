"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { LockIcon, EyeOffIcon, ArrowDownIcon, ArrowUpIcon, Copy, Download, X } from "lucide-react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { PhantomWalletName } from "@solana/wallet-adapter-phantom";
import { 
  PublicKey, 
  Keypair, 
  SystemProgram, 
  TransactionMessage, 
  VersionedTransaction,
  ComputeBudgetProgram 
} from "@solana/web3.js";
import { toast } from "sonner";

export default function MixerPage() {
  const { publicKey, connected, sendTransaction, connect, disconnect, connecting, select } = useWallet();
  const fixedAmounts = [0.1, 1, 10, 100];
  const [selectedAmountIndex, setSelectedAmountIndex] = useState([1]);
  const [note, setNote] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [isShielding, setIsShielding] = useState(false);
  const [showNotePopup, setShowNotePopup] = useState(false);
  const [generatedNote, setGeneratedNote] = useState("");
  const [noteBalance, setNoteBalance] = useState("0.0000");

  const RPC_URL = "https://api.devnet.solana.com";
  const TORNADO_PROGRAM_ID = "wFafLjoy9oEs8jqWC65kDMB4MdpBCoT5imbqsddqFJJ";

  const handleNoteChange = useCallback(async (value: string) => {
    setNote(value);
    if (value && value.length > 10) {
      setNoteBalance("0.0000");
    } else {
      setNoteBalance("0.0000");
    }
  }, []);

  const handleDeposit = async () => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    const amount = fixedAmounts[selectedAmountIndex[0]].toString();
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please select a valid amount');
      return;
    }

    setIsShielding(true);

    try {
      const { getProgram, DUMMY_COMMITMENT, DEPOSIT_AMOUNT } = await import('@/lib/program');
      const program = getProgram({ publicKey, signTransaction: sendTransaction, signAllTransactions: sendTransaction } as any);
      
      const [tornadoPool] = PublicKey.findProgramAddressSync(
        [Buffer.from("tornado_pool")],
        program.programId
      );
      
      toast.info("Initiating deposit transaction...");

      const tx = await program.methods
        .deposit(DUMMY_COMMITMENT)
        .accounts({
          tornadoPool,
          user: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      toast.success(`Deposit successful! Transaction: ${tx}`);
      console.log("Deposit transaction:", tx);
      
    } catch (error) {
      console.error('Deposit error:', error);
      toast.error(`Failed to create deposit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsShielding(false);
    }
  };

  const handleWithdraw = async () => {
    if (!note || !recipientAddress) {
      toast.error('Please enter both note and recipient address');
      return;
    }

    if (!connected || !publicKey) {
      toast.error('Please connect your wallet');
      return;
    }

    setIsShielding(true);

    try {
      const { 
        getProgram, 
        DUMMY_PROOF, 
        DUMMY_MERKLE_PROOF, 
        DUMMY_PATH_INDICES,
        DUMMY_RECIPIENT,
        DUMMY_RELAYER,
        DUMMY_FEE 
      } = await import('@/lib/program');
      const program = getProgram({ publicKey, signTransaction: sendTransaction, signAllTransactions: sendTransaction } as any);
      
      const [tornadoPool] = PublicKey.findProgramAddressSync(
        [Buffer.from("tornado_pool")],
        program.programId
      );
      
      toast.info("Initiating withdrawal with dummy proof...");

      const tx = await program.methods
        .withdraw(
          DUMMY_PROOF.pi_a,
          DUMMY_PROOF.pi_b,
          DUMMY_PROOF.pi_c,
          DUMMY_MERKLE_PROOF,
          DUMMY_PATH_INDICES,
          new PublicKey(recipientAddress),
          DUMMY_RELAYER,
          DUMMY_FEE
        )
        .accounts({
          tornadoPool,
          recipient: new PublicKey(recipientAddress),
          relayer: DUMMY_RELAYER,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      toast.success(`Withdrawal successful! Transaction: ${tx}`);
      console.log("Withdrawal transaction:", tx);
      setNote('');
      setRecipientAddress('');
      
    } catch (error) {
      console.error('Withdrawal error:', error);
      toast.error(`Failed to withdraw: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsShielding(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const downloadNote = () => {
    const element = document.createElement("a");
    const file = new Blob([generatedNote], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = "tornado-note.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="h-screen bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-cyber-dark via-background to-cyber-surface opacity-90" />
      <div className="absolute top-20 left-20 w-64 h-64 bg-cyber-glow opacity-5 rounded-full blur-3xl animate-cyber-pulse" />
      <div className="absolute bottom-20 right-20 w-48 h-48 bg-cyber-secondary opacity-5 rounded-full blur-3xl animate-cyber-pulse" style={{ animationDelay: '1s' }} />
      
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={connected ? disconnect : () => {
            select(PhantomWalletName);
            connect();
          }}
          disabled={connecting}
          className="bg-transparent text-white font-mono text-sm px-4 py-3 min-w-0 w-auto h-12 rounded-md border border-cyber-glow/30 hover:bg-cyber-glow/10 transition-colors"
        >
          {connecting ? 'Connecting...' : connected ? 'Connected' : 'Connect'}
        </button>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto py-8 transform scale-[0.8] origin-top">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image 
              src="/finalogo.svg" 
              alt="Mystify Logo" 
              width={40} 
              height={40} 
              className="h-10 w-10 animate-glow"
            />
            <h1 className="text-4xl font-bold text-cyber-glow animate-glow font-mono">
              MYSTIFY
            </h1>
          </div>
          <p className="text-muted-foreground font-mono text-sm tracking-wider">
            <a 
              href="https://dexscreener.com/solana/6ljxokahhsrpsrgp98py2vzjauzcp8clwkjmlyu1wljg" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-cyber-glow hover:text-white transition-colors cursor-pointer underline"
            >
              DexScreener
            </a> • <a 
              href="https://x.com/Mystify_Sol/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-cyber-glow hover:text-white transition-colors cursor-pointer underline"
            >
              X/Twitter
            </a>
          </p>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-cyber-glow font-mono">
            <div className="flex items-center gap-1">
              <LockIcon className="h-3 w-3" />
              <span>ENCRYPTED</span>
            </div>
            <div className="flex items-center gap-1">
              <EyeOffIcon className="h-3 w-3" />
              <span>PRIVATE</span>
            </div>
          </div>
        </div>

        <div className="grid gap-8 grid-cols-1 max-w-2xl mx-auto">
          <Card className="bg-cyber-surface border-cyber-glow/30 shadow-cyber">
            <CardHeader>
              <CardTitle className="text-cyber-glow font-mono">
                TORNADO PROTOCOL
              </CardTitle>
              <CardDescription className="text-muted-foreground font-mono text-xs">
                Anonymize your on-chain holdings with zero-knowledge proofs
              </CardDescription>
            </CardHeader>
            
            <CardContent className="pb-4">
              <Tabs defaultValue="deposit" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-cyber-dark border border-cyber-glow/20">
                  <TabsTrigger 
                    value="deposit" 
                    className="font-mono data-[state=active]:bg-cyber-glow data-[state=active]:text-cyber-dark"
                  >
                    <ArrowDownIcon className="h-4 w-4 mr-2" />
                    DEPOSIT
                  </TabsTrigger>
                  <TabsTrigger 
                    value="withdraw" 
                    className="font-mono data-[state=active]:bg-cyber-glow data-[state=active]:text-cyber-dark"
                  >
                    <ArrowUpIcon className="h-4 w-4 mr-2" />
                    WITHDRAW
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="deposit" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-cyber-glow font-mono text-sm">AMOUNT (SOL)</Label>
                      <span className="text-cyber-glow font-mono text-lg font-bold">
                        {fixedAmounts[selectedAmountIndex[0]]} SOL
                      </span>
                    </div>
                    
                    <div className="px-3 py-6">
                      <Slider
                        value={selectedAmountIndex}
                        onValueChange={setSelectedAmountIndex}
                        max={3}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground font-mono mt-2">
                        <span>0.1 SOL</span>
                        <span>1 SOL</span>
                        <span>10 SOL</span>
                        <span>100 SOL</span>
                      </div>
                    </div>

                    <Button 
                      variant="cyber" 
                      className="w-full py-6 text-lg"
                      onClick={handleDeposit}
                      disabled={isShielding}
                    >
                      {isShielding ? 'PROCESSING...' : 'INITIATE DEPOSIT'}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="withdraw" className="space-y-6 mt-6 transform scale-[0.9] origin-top">
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Label htmlFor="note" className="text-cyber-glow font-mono text-sm">
                          SECRET NOTE
                        </Label>
                        {note && (
                          <span className="text-cyber-glow font-mono text-xs">
                            Balance: {noteBalance} SOL
                          </span>
                        )}
                      </div>
                      <Textarea
                        id="note"
                        placeholder="Paste your secret note here..."
                        value={note}
                        onChange={(e) => handleNoteChange(e.target.value)}
                        className="mt-2 bg-cyber-dark border-cyber-glow/30 text-cyber-glow font-mono placeholder:text-muted-foreground resize-none"
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        This note was generated during your deposit transaction
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="recipient" className="text-cyber-glow font-mono text-sm">
                        RECIPIENT ADDRESS
                      </Label>
                      <Input
                        id="recipient"
                        placeholder="Solana address..."
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        className="mt-2 bg-cyber-dark border-cyber-glow/30 text-cyber-glow font-mono placeholder:text-muted-foreground"
                      />
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        Destination address for your anonymous withdrawal
                      </p>
                    </div>

                    <Button 
                      variant="cyber" 
                      className="w-full py-6 text-lg"
                      onClick={handleWithdraw}
                      disabled={!note || !recipientAddress || isShielding}
                    >
                      {isShielding ? 'PROCESSING...' : 'EXECUTE WITHDRAWAL'}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8 text-xs text-muted-foreground font-mono">
          <p>NO LOGS • NO KYC • NO TRACES</p>
          <p className="mt-1">Your privacy is your right.</p>
        </div>
      </div>

      {showNotePopup && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-cyber-surface border border-cyber-glow/30 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-cyber-glow font-mono text-lg">BACKUP YOUR NOTE</h3>
              <button
                onClick={() => setShowNotePopup(false)}
                className="text-cyber-glow hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <p className="text-white text-sm mb-4 font-mono">
              Please back up your note. You will need it later to withdraw your deposit.
              Treat your note as a private key - never share it with anyone.
            </p>

            <div className="bg-cyber-dark p-3 rounded-lg mb-4 relative">
              <p className="text-cyber-glow font-mono text-xs break-all">
                {generatedNote}
              </p>
              <button
                onClick={() => copyToClipboard(generatedNote)}
                className="absolute top-2 right-2 text-cyber-glow hover:text-white"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => copyToClipboard(generatedNote)}
                variant="cyber"
                className="flex-1"
              >
                <Copy className="h-4 w-4 mr-2" />
                COPY
              </Button>
              <Button
                onClick={downloadNote}
                variant="cyber"
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                DOWNLOAD
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
