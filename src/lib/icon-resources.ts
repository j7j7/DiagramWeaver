/**
 * Standard icons (web framework symbols + emojis) for the diagram palette.
 * These can be dragged onto the canvas as 80x80 nodes, same size as other items.
 */
import type { LucideIcon } from "lucide-react";
import {
  Home,
  Shield,
  User,
  Building2,
  Heart,
  Star,
  Lock,
  Key,
  Mail,
  Phone,
  Globe,
  Settings,
  ShieldCheck,
  Users,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  Zap,
  Cloud,
  Database,
  Server,
  Wifi,
  Bell,
  Bookmark,
  Camera,
  File,
  Folder,
  Gift,
  MapPin,
  UserCircle,
  MessageCircle,
  Send,
  FileText,
  Clipboard,
  Search,
  Pencil,
  Trash2,
  Download,
  Upload,
  Wrench,
  Cpu,
  HardDrive,
  Monitor,
  Landmark,
  Unlock,
  HelpCircle,
  MessageSquare,
  Code,
  Bug,
  Terminal,
  GitBranch,
  Layers,
  Link,
  Share2,
  Copy,
  Plus,
  Minus,
  Filter,
  MoreHorizontal,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  // Additional icons
  UserPlus,
  AtSign,
  ThumbsUp,
  ThumbsDown,
  Smartphone,
  Box,
  Router,
  FolderOpen,
  Image,
  Power,
  RefreshCw,
  RotateCw,
  Timer,
  History,
} from "lucide-react";

export type IconKind = "lucide" | "emoji";

export interface SymbolIconItem {
  name: string;
  iconType: "lucide";
  iconName: string;
  IconComponent: LucideIcon;
}

export interface EmojiIconItem {
  name: string;
  iconType: "emoji";
  emoji: string;
}

export type IconResourceItem = SymbolIconItem | EmojiIconItem;

const LUCIDE_ICONS: Record<string, LucideIcon> = {
  Home, Shield, User, Building2, Heart, Star, Lock, Key, Mail, Phone, Globe,
  Settings, ShieldCheck, Users, AlertTriangle, CheckCircle, Info, XCircle,
  Zap, Cloud, Database, Server, Wifi, Bell, Bookmark, Camera, File, Folder,
  Gift, MapPin, UserCircle, MessageCircle, Send, FileText, Clipboard, Search,
  Pencil, Trash2, Download, Upload, Wrench, Cpu, HardDrive, Monitor, Landmark,
  Unlock, HelpCircle, MessageSquare, Code, Bug, Terminal, GitBranch, Layers,
  Link, Share2, Copy, Plus, Minus, Filter, MoreHorizontal, Calendar, Clock,
  Eye, EyeOff,
  UserPlus, AtSign, ThumbsUp, ThumbsDown, Smartphone, Box, Router,
  FolderOpen, Image, Power, RefreshCw, RotateCw, Timer, History,
};

const icon = (name: string, iconName: string, IconComponent: LucideIcon): SymbolIconItem =>
  ({ name, iconType: "lucide", iconName, IconComponent });

/** Lucide symbols organized by section */
export const SYMBOL_ICON_SECTIONS: Record<string, SymbolIconItem[]> = {
  People: [
    icon("Person", "User", User),
    icon("Users", "Users", Users),
    icon("User Circle", "UserCircle", UserCircle),
    icon("User Plus", "UserPlus", UserPlus),
    icon("Eye", "Eye", Eye),
    icon("Eye Off", "EyeOff", EyeOff),
  ],
  "Places": [
    icon("Home", "Home", Home),
    icon("Building", "Building2", Building2),
    icon("Landmark", "Landmark", Landmark),
    icon("Map Pin", "MapPin", MapPin),
    icon("Globe", "Globe", Globe),
  ],
  Communication: [
    icon("Mail", "Mail", Mail),
    icon("Phone", "Phone", Phone),
    icon("At Sign", "AtSign", AtSign),
    icon("Message", "MessageCircle", MessageCircle),
    icon("Message Square", "MessageSquare", MessageSquare),
    icon("Send", "Send", Send),
    icon("Link", "Link", Link),
    icon("Share", "Share2", Share2),
  ],
  Security: [
    icon("Shield", "Shield", Shield),
    icon("Shield Check", "ShieldCheck", ShieldCheck),
    icon("Lock", "Lock", Lock),
    icon("Unlock", "Unlock", Unlock),
    icon("Key", "Key", Key),
  ],
  "Status": [
    icon("Check Circle", "CheckCircle", CheckCircle),
    icon("X Circle", "XCircle", XCircle),
    icon("Alert", "AlertTriangle", AlertTriangle),
    icon("Info", "Info", Info),
    icon("Help", "HelpCircle", HelpCircle),
    icon("Thumbs Up", "ThumbsUp", ThumbsUp),
    icon("Thumbs Down", "ThumbsDown", ThumbsDown),
  ],
  "Tech": [
    icon("Server", "Server", Server),
    icon("Database", "Database", Database),
    icon("Cloud", "Cloud", Cloud),
    icon("Wifi", "Wifi", Wifi),
    icon("Smartphone", "Smartphone", Smartphone),
    icon("Box", "Box", Box),
    icon("Router", "Router", Router),
    icon("CPU", "Cpu", Cpu),
    icon("Hard Drive", "HardDrive", HardDrive),
    icon("Monitor", "Monitor", Monitor),
    icon("Terminal", "Terminal", Terminal),
  ],
  Documents: [
    icon("File", "File", File),
    icon("File Text", "FileText", FileText),
    icon("Folder", "Folder", Folder),
    icon("Folder Open", "FolderOpen", FolderOpen),
    icon("Clipboard", "Clipboard", Clipboard),
    icon("Image", "Image", Image),
  ],
  "Code": [
    icon("Code", "Code", Code),
    icon("Bug", "Bug", Bug),
    icon("Git Branch", "GitBranch", GitBranch),
    icon("Layers", "Layers", Layers),
  ],
  Actions: [
    icon("Settings", "Settings", Settings),
    icon("Bell", "Bell", Bell),
    icon("Bookmark", "Bookmark", Bookmark),
    icon("Camera", "Camera", Camera),
    icon("Gift", "Gift", Gift),
    icon("Zap", "Zap", Zap),
    icon("Power", "Power", Power),
    icon("Refresh", "RefreshCw", RefreshCw),
    icon("Search", "Search", Search),
    icon("Filter", "Filter", Filter),
  ],
  Tools: [
    icon("Pencil", "Pencil", Pencil),
    icon("Copy", "Copy", Copy),
    icon("Trash", "Trash2", Trash2),
    icon("Download", "Download", Download),
    icon("Upload", "Upload", Upload),
    icon("Wrench", "Wrench", Wrench),
    icon("Rotate", "RotateCw", RotateCw),
    icon("Plus", "Plus", Plus),
    icon("Minus", "Minus", Minus),
    icon("More", "MoreHorizontal", MoreHorizontal),
  ],
  "Time": [
    icon("Calendar", "Calendar", Calendar),
    icon("Clock", "Clock", Clock),
    icon("Timer", "Timer", Timer),
    icon("History", "History", History),
    icon("Star", "Star", Star),
    icon("Heart", "Heart", Heart),
  ],
};

/** Flat list of all symbol icons (backward compat / search) */
export const SYMBOL_ICONS: SymbolIconItem[] = Object.values(SYMBOL_ICON_SECTIONS).flat();

/** Emoji icons - universal symbols */
export const EMOJI_ICONS: EmojiIconItem[] = [
  { name: "House", iconType: "emoji", emoji: "🏠" },
  { name: "Shield", iconType: "emoji", emoji: "🛡️" },
  { name: "Person", iconType: "emoji", emoji: "👤" },
  { name: "Office", iconType: "emoji", emoji: "🏢" },
  { name: "Heart", iconType: "emoji", emoji: "❤️" },
  { name: "Star", iconType: "emoji", emoji: "⭐" },
  { name: "Lock", iconType: "emoji", emoji: "🔒" },
  { name: "Key", iconType: "emoji", emoji: "🔑" },
  { name: "Email", iconType: "emoji", emoji: "📧" },
  { name: "Phone", iconType: "emoji", emoji: "📱" },
  { name: "Globe", iconType: "emoji", emoji: "🌐" },
  { name: "Gear", iconType: "emoji", emoji: "⚙️" },
  { name: "People", iconType: "emoji", emoji: "👥" },
  { name: "Warning", iconType: "emoji", emoji: "⚠️" },
  { name: "Check", iconType: "emoji", emoji: "✅" },
  { name: "Info", iconType: "emoji", emoji: "ℹ️" },
  { name: "X", iconType: "emoji", emoji: "❌" },
  { name: "Lightning", iconType: "emoji", emoji: "⚡" },
  { name: "Cloud", iconType: "emoji", emoji: "☁️" },
  { name: "Database", iconType: "emoji", emoji: "🗄️" },
  { name: "Computer", iconType: "emoji", emoji: "💻" },
  { name: "Rocket", iconType: "emoji", emoji: "🚀" },
  { name: "Bell", iconType: "emoji", emoji: "🔔" },
  { name: "Bookmark", iconType: "emoji", emoji: "🔖" },
  { name: "Camera", iconType: "emoji", emoji: "📷" },
  { name: "Document", iconType: "emoji", emoji: "📄" },
  { name: "Folder", iconType: "emoji", emoji: "📁" },
  { name: "Gift", iconType: "emoji", emoji: "🎁" },
  { name: "Location", iconType: "emoji", emoji: "📍" },
];

/** Slug derived from iconName (e.g. "FileText" -> "filetext") - matches type suffix in generic.icon.{slug} */
function slugifyIconName(name: string): string {
  return name.replace(/\s+/g, "-").toLowerCase();
}

/** Map type slug (e.g. "filetext") to Lucide iconName (e.g. "FileText") for correct lookup */
const TYPE_SLUG_TO_ICON_NAME: Record<string, string> = Object.fromEntries(
  SYMBOL_ICONS.map((item) => [slugifyIconName(item.iconName), item.iconName])
);

/** Get Lucide icon component by name (for dynamic lookups from stored type) */
export function getLucideIcon(iconName: string): LucideIcon | null {
  return LUCIDE_ICONS[iconName] ?? null;
}

/** Get Lucide icon from type slug (e.g. "filetext" from generic.icon.filetext) when iconName not in JSON */
export function getLucideIconFromTypeSlug(slug: string): LucideIcon | null {
  const iconName = TYPE_SLUG_TO_ICON_NAME[slug];
  return iconName ? getLucideIcon(iconName) : null;
}
