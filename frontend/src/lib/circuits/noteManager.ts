import { generateCommitment, generateNullifierHash } from './poseidon';

export interface TornadoNote {
  nullifier: string;
  secret: string;
  commitment: string;
  amount: number;
  timestamp: number;
}

export class NoteManager {
  private static readonly STORAGE_KEY = 'tornado_notes';

  static generateNote(amount: number = 100000000): TornadoNote {
    const nullifier = this.generateRandomHex(64);
    const secret = this.generateRandomHex(64);
    const commitment = generateCommitment(nullifier, secret);
    
    return {
      nullifier,
      secret,
      commitment: commitment.toString(),
      amount,
      timestamp: Date.now()
    };
  }

  static saveNote(note: TornadoNote): void {
    const notes = this.getAllNotes();
    notes.push(note);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notes));
  }

  static getAllNotes(): TornadoNote[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static getNoteByCommitment(commitment: string): TornadoNote | null {
    const notes = this.getAllNotes();
    return notes.find(note => note.commitment === commitment) || null;
  }

  static parseNoteString(noteString: string): TornadoNote | null {
    try {
      const parts = noteString.split('-');
      if (parts.length !== 3) return null;
      
      const [nullifier, secret, amountStr] = parts;
      const amount = parseInt(amountStr);
      const commitment = generateCommitment(nullifier, secret);
      
      return {
        nullifier,
        secret,
        commitment: commitment.toString(),
        amount,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Failed to parse note string:', error);
      return null;
    }
  }

  static formatNoteString(note: TornadoNote): string {
    return `${note.nullifier}-${note.secret}-${note.amount}`;
  }

  static validateNote(note: TornadoNote): boolean {
    try {
      const expectedCommitment = generateCommitment(note.nullifier, note.secret);
      return expectedCommitment.toString() === note.commitment;
    } catch (error) {
      return false;
    }
  }

  private static generateRandomHex(length: number): string {
    const bytes = new Uint8Array(length / 2);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  static clearAllNotes(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  static exportNotes(): string {
    const notes = this.getAllNotes();
    return JSON.stringify(notes, null, 2);
  }

  static importNotes(notesJson: string): boolean {
    try {
      const notes = JSON.parse(notesJson);
      if (!Array.isArray(notes)) return false;
      
      const validNotes = notes.filter(note => this.validateNote(note));
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(validNotes));
      return true;
    } catch (error) {
      return false;
    }
  }
}
