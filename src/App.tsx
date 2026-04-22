import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate,
  useLocation,
  useParams
} from 'react-router-dom';
import { supabase, isSupabaseConfigured } from './supabase';
import { 
  UserProfile, 
  Project, 
  WorkflowConfig, 
  WORKFLOW_STEP_NAMES, 
  UserRole, 
  Team,
  WorkflowStep,
  StepStatus,
  WorkflowConfigStep
} from './types';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Settings, 
  LogOut, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  User as UserIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Briefcase,
  Users,
  FileText,
  Calendar,
  Send,
  ArrowRight,
  Check,
  X,
  Menu,
  FilePlus,
  Activity,
  GripVertical,
  Trash2,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const sendEmailNotification = async (email: string, stepName: string, projectName: string, type: 'new' | 'update' = 'update', projectId?: string) => {
  if (!email) return;
  
  const subject = type === 'new' 
    ? `New Project Assigned: ${projectName}` 
    : `Action Required: New Step in ${projectName}`;
    
  const baseUrl = window.location.origin;
  const dashboardLink = projectId ? `${baseUrl}/project/${projectId}` : baseUrl;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #eee; border-radius: 12px; max-width: 600px; margin: auto;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #2563eb; margin: 0;">FMS PRO SYSTEM</h2>
        <p style="font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">Process Monitoring Dashboard</p>
      </div>
      <p>Hello,</p>
      <p>${type === 'new' ? 'A new project has been initialized and assigned to you.' : 'A workflow step has been completed and the next action is now in your queue.'}</p>
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb; margin: 20px 0;">
        <p style="margin: 0 0 10px 0;"><strong>Project:</strong> ${projectName}</p>
        <p style="margin: 0;"><strong>Action Required:</strong> ${stepName}</p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${dashboardLink}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">OPEN DASHBOARD</a>
      </div>
      <p style="font-size: 13px; color: #64748b;">Please log in to the FMS Pro dashboard to process this step. You can view the full timeline and update the status directly from the command center.</p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 30px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center;">This is an automated system notification. Please do not reply to this email.</p>
    </div>
  `;

  try {
    console.log(`Attempting to send email to: ${email}, Subject: ${subject}`);
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        subject,
        html
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to send email notification:', errorData);
    } else {
      console.log('Email notification sent successfully');
    }
  } catch (error: any) {
    console.error('Email notification error:', error);
    if (error.message === 'Failed to fetch') {
      console.warn('Email API (/api/send-email) is unreachable. Ensure the server is running.');
    }
  }
};

// --- Auth Context ---
interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

const useAuth = () => useContext(AuthContext);

// --- Components ---

const LoadingScreen = () => (
  <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
    <div className="relative w-16 h-16">
      <div className="absolute inset-0 border-4 border-blue-100 rounded-full" />
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full"
      />
    </div>
    <p className="mt-4 text-sm font-medium text-gray-500 animate-pulse">Loading FMS Pro...</p>
  </div>
);

const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("animate-pulse rounded-md bg-gray-200", className)} {...props} />
);

const DashboardSkeleton = () => (
  <div className="p-8 space-y-8">
    <div className="flex justify-between items-end">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
    </div>
    <Skeleton className="h-96 w-full rounded-2xl" />
  </div>
);

const ProjectDetailSkeleton = () => (
  <div className="p-8 space-y-8">
    <div className="flex items-center gap-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  </div>
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger', size?: 'sm' | 'md' | 'lg' }>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: "bg-blue-600 text-white hover:bg-blue-700",
      secondary: "bg-gray-900 text-white hover:bg-gray-800",
      outline: "border border-gray-200 bg-white hover:bg-gray-100 text-gray-900",
      ghost: "hover:bg-gray-100 text-gray-700",
      danger: "bg-red-600 text-white hover:bg-red-700",
    };
    const sizes = {
      sm: "px-3 py-1.5 text-xs",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-3 text-base",
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

// --- Auth Pages ---

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      toast.error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in settings.');
      return;
    }
    setLoading(true);
    const trimmedEmail = email.trim();
    console.log('Attempting login for:', trimmedEmail);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (error) {
        if (error.message === 'Invalid login credentials') {
          throw new Error("Invalid email or password. Please check your credentials or create a new account if you haven't already.");
        }
        throw error;
      }
      console.log('Login successful:', data);
      toast.success('Logged in successfully');
      navigate('/');
    } catch (error: any) {
      console.error('Caught login error:', error);
      toast.error(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100"
      >
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-white p-2 rounded-2xl border border-gray-100 shadow-xl overflow-hidden w-24">
                <img 
                  src="https://www.ginzalimited.com/cdn/shop/files/Ginza_logo.jpg?v=1668509673&width=850" 
                  alt="GINZA Logo" 
                  className="w-full h-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">FMS PRO <span className="text-blue-600">LOGIN</span></h2>
          <p className="mt-1 text-[10px] text-gray-500 font-mono uppercase tracking-widest">Ginza Limited Process Control</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input 
                type="email" 
                placeholder="SYSTEM_EMAIL" 
                className="pl-10 font-mono text-sm uppercase placeholder:text-gray-300"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input 
                type={showPassword ? "text" : "password"} 
                placeholder="ACCESS_KEY" 
                className="pl-10 pr-10 font-mono text-sm uppercase placeholder:text-gray-300"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-600/20" disabled={loading}>
            {loading ? "AUTHENTICATING..." : "INITIATE_SESSION"}
          </Button>
          <div className="flex flex-col gap-4 text-center">
            <div className="flex items-center gap-2 justify-center">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Secure SSL Connection Active</span>
            </div>
            <button 
              type="button"
              onClick={() => toast.info('Password reset functionality coming soon!')}
              className="text-sm text-blue-600 hover:underline"
            >
              Forgot Password?
            </button>
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <button 
                type="button"
                onClick={() => navigate('/signup')}
                className="text-blue-600 font-semibold hover:underline"
              >
                Create Account
              </button>
            </p>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const SignUp = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'Merchandiser' as UserRole,
    team: 'Domestic' as Team
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured()) {
      toast.error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in settings.');
      return;
    }
    setLoading(true);
    console.log('Attempting sign up for:', formData.email);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            role: formData.role,
            team: formData.role === 'Merchandiser' ? formData.team : undefined
          }
        }
      });

      if (authError) {
        console.error('Auth sign up error:', authError);
        throw authError;
      }
      if (!authData.user) throw new Error('Sign up failed: No user returned');
      
      console.log('Auth sign up successful:', authData.user.id);

      const profile: UserProfile = {
        uid: authData.user.id,
        email: formData.email,
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: formData.role,
        team: formData.role === 'Merchandiser' ? formData.team : undefined
      };

      console.log('Inserting profile:', profile);
      const { error: profileError } = await supabase.from('profiles').upsert([profile], { onConflict: 'uid' });
      if (profileError) {
        console.error('Profile upsert error:', profileError);
        // If profile upsert fails with "42P01", the table is missing
        if (profileError.code === '42P01') {
          throw new Error('Database table "profiles" not found. Please ensure you have run the SQL setup script in your Supabase dashboard.');
        } else if (profileError.code === 'PGRST204' || profileError.message.includes('406')) {
          throw new Error('Database schema issue (406). This usually means the "profiles" table does not exist or is not accessible.');
        } else {
          // We don't throw here if it's a non-critical error, as the user is already created in Auth
          toast.error('Account created but profile setup failed: ' + profileError.message);
        }
      } else {
        console.log('Profile upsert successful');
      }
      
      setIsSuccess(true);
      toast.success('Account created successfully!');
    } catch (error: any) {
      console.error('Caught sign up error:', error);
      toast.error(error.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-gray-100 text-center space-y-6"
        >
          <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-gray-900">Check your email</h2>
            <p className="text-gray-600">
              We've sent a verification link to <span className="font-semibold text-gray-900">{formData.email}</span>. 
              Please verify your email to activate your account.
            </p>
          </div>
          <div className="pt-4 space-y-4">
            <Button onClick={() => navigate('/login')} className="w-full h-11">
              Go to Login
            </Button>
            <button 
              type="button"
              onClick={async () => {
                const { error } = await supabase.auth.resend({
                  type: 'signup',
                  email: formData.email,
                });
                if (error) {
                  toast.error('Failed to resend email: ' + error.message);
                } else {
                  toast.success('Verification email resent!');
                }
              }}
              className="text-sm text-blue-600 font-medium hover:underline block mx-auto"
            >
              Resend verification email
            </button>
            <p className="text-xs text-gray-400">
              Didn't receive the email? Check your spam folder or contact support.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100"
      >
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-white p-2 rounded-2xl border border-gray-100 shadow-xl overflow-hidden w-24">
                <img 
                  src="https://www.ginzalimited.com/cdn/shop/files/Ginza_logo.jpg?v=1668509673&width=850" 
                  alt="GINZA Logo" 
                  className="w-full h-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">FMS PRO <span className="text-blue-600">SIGNUP</span></h2>
          <p className="mt-1 text-[10px] text-gray-500 font-mono uppercase tracking-widest">Create New Operator Identity</p>
        </div>
        <form className="mt-8 space-y-4" onSubmit={handleSignUp}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-black uppercase tracking-widest">First Name</label>
              <Input 
                placeholder="FIRST_NAME" 
                className="font-mono text-sm uppercase placeholder:text-gray-300"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-black uppercase tracking-widest">Last Name</label>
              <Input 
                placeholder="LAST_NAME" 
                className="font-mono text-sm uppercase placeholder:text-gray-300"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                required
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-black uppercase tracking-widest">Email Address</label>
            <Input 
              type="email" 
              placeholder="SYSTEM_EMAIL" 
              className="font-mono text-sm uppercase placeholder:text-gray-300"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-black uppercase tracking-widest">Access Key</label>
            <div className="relative">
              <Input 
                type={showPassword ? "text" : "password"} 
                placeholder="SECURE_PASSWORD" 
                className="pr-10 font-mono text-sm uppercase placeholder:text-gray-300"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-black uppercase tracking-widest">Assigned Role</label>
              <select 
                className="w-full h-10 px-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none font-mono uppercase"
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
              >
                <option value="Merchandiser">Merchandiser</option>
                <option value="Factory Team">Factory Team</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            {formData.role === 'Merchandiser' && (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">Team Node</label>
                <select 
                  className="w-full h-10 px-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none font-mono uppercase"
                  value={formData.team}
                  onChange={(e) => setFormData({...formData, team: e.target.value as Team})}
                >
                  <option value="Export">Export</option>
                  <option value="Domestic">Domestic</option>
                </select>
              </div>
            )}
          </div>
          <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-600/20" disabled={loading}>
            {loading ? "INITIALIZING..." : "CREATE_IDENTITY"}
          </Button>
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <button 
                type="button"
                onClick={() => navigate('/login')}
                className="text-blue-600 font-semibold hover:underline"
              >
                Sign In
              </button>
            </p>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// --- Main Application ---

const WorkflowSkeleton = () => (
  <div className="p-8 space-y-8">
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-10 w-40 rounded-xl" />
    </div>
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-24" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/', roles: ['Admin', 'Merchandiser', 'Factory Team'], color: 'text-blue-500' },
    { name: 'Customer Requirement', icon: FilePlus, path: '/new-entry', roles: ['Merchandiser', 'Admin'], color: 'text-amber-500' },
    { name: 'Workflow Config', icon: Settings, path: '/config', roles: ['Admin'], color: 'text-purple-500' },
    { name: 'Profile', icon: UserIcon, path: '/profile', roles: ['Admin', 'Merchandiser', 'Factory Team'], color: 'text-emerald-500' },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <div className={cn(
        "fixed inset-y-0 left-0 w-64 bg-[#0F172A] text-white flex flex-col border-r border-white/10 z-50 transition-transform duration-300 lg:relative lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded overflow-hidden bg-white flex items-center justify-center">
              <img 
                src="https://www.ginzalimited.com/cdn/shop/files/Ginza_logo.jpg?v=1668509673&width=700" 
                alt="GINZA Logo" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight">GINZA FMS</span>
              <span className="text-[10px] text-blue-400 font-mono uppercase tracking-widest">Monitoring System</span>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 px-3 py-6 space-y-2">
          {navItems.filter(item => profile && (item.roles.includes(profile.role) || profile.role === 'Admin')).map((item) => (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative overflow-hidden",
                location.pathname === item.path 
                  ? "bg-white/10 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]" 
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <div className={cn(
                "p-2 rounded-md flex items-center justify-center transition-all duration-300 shadow-lg",
                location.pathname === item.path 
                  ? cn("bg-gradient-to-br shadow-[0_4px_12px_-2px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] scale-110", 
                       item.color.replace('text-', 'from-').replace('500', '600') + " " + item.color.replace('text-', 'to-').replace('500', '400'))
                  : "bg-gray-800/50 text-gray-500 group-hover:bg-gray-700/50 group-hover:text-gray-300"
              )}>
                <item.icon className={cn(
                  "w-4 h-4 drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]",
                  location.pathname === item.path ? "text-white" : ""
                )} />
              </div>
              <span className={cn(
                "text-sm font-bold tracking-tight transition-all",
                location.pathname === item.path ? "translate-x-1" : ""
              )}>{item.name}</span>
              
              {location.pathname === item.path && (
                <motion.div 
                  layoutId="activeNav"
                  className="absolute left-0 w-1 h-6 bg-white rounded-r-full"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 bg-black/20 border-t border-white/5">
          <div className="flex items-center gap-3 px-2 py-3 mb-4">
            <div className="w-9 h-9 rounded bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
              {profile?.first_name?.[0] || '?'}{profile?.last_name?.[0] || '?'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate text-gray-200">{profile?.first_name || 'User'} {profile?.last_name || ''}</p>
              <p className="text-[10px] text-blue-400 font-mono uppercase tracking-tighter truncate">{profile?.role || 'No Role'}</p>
            </div>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-[11px] font-bold uppercase tracking-wider text-gray-500 hover:text-red-400 hover:bg-red-400/5 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>System Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

const Dashboard = () => {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    const fetchProjects = async () => {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      let query = supabase.from('projects').select('*');
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        toast.error('Failed to fetch projects');
        return;
      }

      const projectList = data as any[];
      setProjects(projectList);
      setLoading(false);
    };

    fetchProjects();
    
    const subscription = supabase
      .channel('projects_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        fetchProjects();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile]);

  const exportToCSV = () => {
    if (projects.length === 0) return;
    const headers = ["Project Name", "Customer", "PO Number", "Current Step", "Status", "Created At"];
    const rows = projects.map(p => [
      p.project_name,
      p.customer_name,
      p.po_number,
      p.steps[p.current_step_index]?.name || 'Completed',
      p.status,
      p.created_at
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `fms_export_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Data exported to CSV');
  };

  if (loading) return <DashboardSkeleton />;

  const activeProjects = projects.filter(p => p.status === 'Active');
  const completedProjects = projects.filter(p => p.status === 'Completed');

  const istTime = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(currentTime);

  return (
    <div className="p-4 lg:p-6 space-y-6 bg-[#F8F9FA] min-h-full">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 border-b border-gray-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="px-2 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded uppercase tracking-widest">Live</div>
            <h1 className="text-lg lg:text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              PROCESS MONITORING DASHBOARD
            </h1>
          </div>
          <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest flex flex-wrap items-center gap-2">
            <Clock className="w-3 h-3 text-blue-600" />
            IST TIME: <span className="text-blue-600 font-bold">{istTime}</span> | 
            DATE: <span className="text-gray-600 font-bold">{format(currentTime, 'dd MMM yyyy')}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <Button variant="outline" onClick={exportToCSV} className="flex-1 lg:flex-none h-9 text-[10px] lg:text-xs font-bold uppercase tracking-wider border-gray-300 bg-white hover:bg-gray-50 shadow-sm">
            <FileText className="w-3.5 h-3.5 mr-2" />
            Export CSV
          </Button>
          {(profile?.role === 'Merchandiser' || profile?.role === 'Admin') && (
            <Button onClick={() => navigate('/new-entry')} className="w-full lg:w-auto h-9 text-[10px] lg:text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20">
              <PlusCircle className="w-3.5 h-3.5 mr-2" />
              New Requirement
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'TOTAL PROJECTS', value: projects.length, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-b-gray-400' },
          { label: 'ACTIVE FLOWS', value: activeProjects.length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-b-gray-400' },
          { label: 'SYSTEM COMPLETED', value: completedProjects.length, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-b-gray-400' }
        ].map((stat, i) => (
          <div key={i} className={cn("bg-white p-4 border border-gray-100 rounded-lg shadow-[0_10px_20px_rgba(0,0,0,0.05),0_6px_6px_rgba(0,0,0,0.1)] flex items-center gap-4 transition-all hover:shadow-2xl hover:-translate-y-1 border-b-4", stat.border)}>
            <div className={cn("p-2.5 rounded-lg shadow-inner", stat.bg, stat.color)}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-mono font-black text-gray-900 leading-none mt-1">{stat.value.toString().padStart(3, '0')}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded shadow-lg overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-sm font-black uppercase tracking-widest text-red-600">Live Process Monitoring</h2>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
            <span className="text-[10px] font-mono text-emerald-600 font-bold uppercase">System Online</span>
          </div>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="fms-header">ID / Project Details</th>
                <th className="fms-header">Current Process Step</th>
                <th className="fms-header">Assigned Operator</th>
                <th className="fms-header">Flow Status</th>
                <th className="fms-header text-right">System Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="fms-row">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900">{project.project_name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] font-mono text-gray-400 uppercase tracking-tighter">
                          PI NUMBER: {project.po_number} | {project.customer_name}
                        </span>
                        <span className="text-[9px] font-mono text-emerald-600 font-bold uppercase">
                          • {format(new Date(project.created_at), 'MMM dd')}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      <span className="text-xs font-mono font-bold text-blue-700 uppercase">
                        {project.steps[project.current_step_index]?.name || 'FLOW_END'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono text-gray-600">{project.steps[project.current_step_index]?.assignedToEmail || 'SYSTEM'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-0.5 rounded border",
                      project.status === 'Active' 
                        ? "bg-amber-50 text-amber-700 border-amber-200" 
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    )}>
                      {project.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => navigate(`/project/${project.id}`)}
                      className="text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      [ View Monitor ]
                    </button>
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-mono text-xs italic">
                    NO ACTIVE PROCESS FLOWS DETECTED
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const NewEntry = () => {
  const { profile } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  
  const [formData, setFormData] = useState({
    customerName: '',
    projectName: '',
    poNumber: '',
    poDate: today,
    articleName: '',
    color: '',
    quantity: '',
    orderDate: today,
    dispatchDate: tomorrow,
    remark: ''
  });
  const [previewList, setPreviewList] = useState<any[]>([]);
  const [workflowConfig, setWorkflowConfig] = useState<WorkflowConfig | null>(null);
  const [customSteps, setCustomSteps] = useState<(WorkflowConfigStep & { plannedDate: string })[]>([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const calculateDates = (steps: any[], orderDate: string) => {
    const newSteps = [...steps];
    
    // Default TATs as per user request
    const defaultTATs: Record<string, number> = {
      "Style Handover": 3,
      "Fit Sample Approval": 15,
      "Lab / Strike-off Approval": 7,
      "Fabric / Trim PO": 3,
      "Fabric Inhouse": 35,
      "FPT (Fabric Performance Test)": 7,
      "Trims & Accessories Arrangement": 25,
      "GPT / PP / PS": 10,
      "Cutting": 1,
      "Sewing": 25,
      "Packing": 3,
      "FI Date": 2,
      "Dispatch": 2
    };

    newSteps.forEach((step, index) => {
      let baseDate = new Date(orderDate);
      
      // If TAT is not set, use default
      if (step.tat === 0 && defaultTATs[step.name]) {
        step.tat = defaultTATs[step.name];
      }

      if (step.name === "Style Handover") {
        step.plannedDate = format(addDays(baseDate, step.tat), 'yyyy-MM-dd');
      } else if (step.name === "Fit Sample Approval") {
        const prev = newSteps.find(s => s.name === "Style Handover");
        const prevDate = prev?.plannedDate ? new Date(prev.plannedDate) : baseDate;
        step.plannedDate = format(addDays(prevDate, step.tat), 'yyyy-MM-dd');
      } else if (step.name === "Lab / Strike-off Approval") {
        const prev = newSteps.find(s => s.name === "Fit Sample Approval");
        const prevDate = prev?.plannedDate ? new Date(prev.plannedDate) : baseDate;
        step.plannedDate = format(addDays(prevDate, step.tat), 'yyyy-MM-dd');
      } else if (step.name === "Fabric / Trim PO") {
        const prev = newSteps.find(s => s.name === "Lab / Strike-off Approval");
        const prevDate = prev?.plannedDate ? new Date(prev.plannedDate) : baseDate;
        step.plannedDate = format(addDays(prevDate, step.tat), 'yyyy-MM-dd');
      } else if (step.name === "Fabric Inhouse") {
        const prev = newSteps.find(s => s.name === "Style Handover");
        const prevDate = prev?.plannedDate ? new Date(prev.plannedDate) : baseDate;
        step.plannedDate = format(addDays(prevDate, step.tat), 'yyyy-MM-dd');
      } else if (step.name === "FPT (Fabric Performance Test)") {
        const prev = newSteps.find(s => s.name === "Fabric Inhouse");
        const prevDate = prev?.plannedDate ? new Date(prev.plannedDate) : baseDate;
        step.plannedDate = format(addDays(prevDate, step.tat), 'yyyy-MM-dd');
      } else if (step.name === "Trims & Accessories Arrangement") {
        const prev = newSteps.find(s => s.name === "Fabric Inhouse");
        const prevDate = prev?.plannedDate ? new Date(prev.plannedDate) : baseDate;
        step.plannedDate = format(addDays(prevDate, step.tat), 'yyyy-MM-dd');
      } else if (step.name === "GPT / PP / PS") {
        const prev = newSteps.find(s => s.name === "Fabric Inhouse");
        const prevDate = prev?.plannedDate ? new Date(prev.plannedDate) : baseDate;
        step.plannedDate = format(addDays(prevDate, step.tat), 'yyyy-MM-dd');
      } else if (step.name === "Cutting") {
        const prev = newSteps.find(s => s.name === "GPT / PP / PS");
        const prevDate = prev?.plannedDate ? new Date(prev.plannedDate) : baseDate;
        step.plannedDate = format(addDays(prevDate, step.tat), 'yyyy-MM-dd');
      } else if (step.name === "Sewing") {
        const prev = newSteps.find(s => s.name === "Cutting");
        const prevDate = prev?.plannedDate ? new Date(prev.plannedDate) : baseDate;
        step.plannedDate = format(addDays(prevDate, step.tat), 'yyyy-MM-dd');
      } else if (step.name === "Packing") {
        const prev = newSteps.find(s => s.name === "Sewing");
        const prevDate = prev?.plannedDate ? new Date(prev.plannedDate) : baseDate;
        step.plannedDate = format(addDays(prevDate, step.tat), 'yyyy-MM-dd');
      } else if (step.name === "FI Date") {
        const prev = newSteps.find(s => s.name === "Packing");
        const prevDate = prev?.plannedDate ? new Date(prev.plannedDate) : baseDate;
        step.plannedDate = format(addDays(prevDate, step.tat), 'yyyy-MM-dd');
      } else if (step.name === "Dispatch") {
        const prev = newSteps.find(s => s.name === "FI Date");
        const prevDate = prev?.plannedDate ? new Date(prev.plannedDate) : baseDate;
        step.plannedDate = format(addDays(prevDate, step.tat), 'yyyy-MM-dd');
      } else {
        const prevDate = index > 0 ? new Date(newSteps[index - 1].plannedDate) : baseDate;
        step.plannedDate = format(addDays(prevDate, step.tat), 'yyyy-MM-dd');
      }
    });
    return newSteps;
  };

  useEffect(() => {
    if (customSteps.length > 0) {
      const updated = calculateDates(customSteps, formData.orderDate);
      // Only update if dates actually changed to avoid infinite loop
      if (JSON.stringify(updated) !== JSON.stringify(customSteps)) {
        setCustomSteps(updated);
      }
    }
  }, [formData.orderDate]);

  useEffect(() => {
    const fetchConfig = async () => {
      if (!isSupabaseConfigured()) return;
      const { data, error } = await supabase.from('config').select('*').eq('id', 'workflow').single();
      
      const initialSteps = WORKFLOW_STEP_NAMES.map(name => {
        if (data) {
          const saved = (data.data.steps as WorkflowConfigStep[]).find(s => s.name === name);
          if (saved) return saved;
        }
        return {
          name,
          assignedToEmail: '',
          tat: 0
        };
      });

      setWorkflowConfig({ steps: initialSteps });
      setCustomSteps([]); // Start with empty steps as requested
    };
    fetchConfig();
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setPreviewList([...previewList, { ...formData, id: Date.now().toString() }]);
    setFormData({
      ...formData,
      projectName: '',
      poNumber: '',
      poDate: today,
      articleName: '',
      color: '',
      quantity: '',
      orderDate: today,
      dispatchDate: tomorrow,
      remark: ''
    });
  };

  const handleSubmit = async () => {
    if (!workflowConfig) {
      toast.error('Workflow configuration not found. Please contact admin.');
      return;
    }
    if (previewList.length === 0) {
      toast.error('Add at least one project to the list.');
      return;
    }

    setLoading(true);
    try {
      // 1. Save to Supabase
      for (const item of previewList) {
        let cumulativeDays = 0;
        const steps: WorkflowStep[] = customSteps.map((s) => {
          let assignedEmail = s.assignedToEmail;
          
          // Custom Logic for specific users for first 3 steps
          const specialEmails = ['pravin.kharat@ginzalimited.com', 'sanjay.baldua@ginzalimited.com'];
          const firstThreeSteps = ["Style Handover", "Fit Sample Approval", "Lab / Strike-off Approval"];
          
          if (firstThreeSteps.includes(s.name) && profile?.email && specialEmails.includes(profile.email.toLowerCase())) {
            assignedEmail = profile.email.toLowerCase();
          }

          return {
            name: s.name,
            plannedDate: new Date(s.plannedDate).toISOString(),
            status: 'Not Done',
            assignedToEmail: assignedEmail,
            tat: s.tat
          };
        });

        const project = {
          merchandiser_uid: profile!.uid,
          merchandiser_name: `${profile!.first_name} ${profile!.last_name}`,
          customer_name: item.customerName,
          project_name: item.projectName,
          po_number: item.poNumber,
          po_date: item.poDate,
          article_name: item.articleName,
          color: item.color,
          quantity: item.quantity,
          order_date: item.orderDate,
          dispatch_date: item.dispatchDate,
          remark: item.remark,
          steps: steps,
          current_step_index: 0,
          status: 'Active'
        };

        const { data: insertedData, error } = await supabase.from('projects').insert([project]).select();
        if (error) throw error;

        // Send Initial Email Notifications for this specific project
        const firstStep = workflowConfig.steps[0];
        if (firstStep && firstStep.assignedToEmail && insertedData && insertedData[0]) {
          await sendEmailNotification(firstStep.assignedToEmail, firstStep.name, item.projectName, 'new', insertedData[0].id);
        }
      }

      toast.success('Requirements submitted successfully');
      navigate('/');
    } catch (error) {
      console.error('Error submitting requirements:', error);
      toast.error('Failed to submit requirements');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 bg-[#F8F9FA] min-h-screen">
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <PlusCircle className="w-6 h-6 text-blue-600" />
          CUSTOMER REQUIREMENT FORM
        </h1>
        <p className="text-xs text-gray-500 font-mono mt-1 uppercase tracking-widest">Process Initiation Module</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-sm font-black uppercase tracking-widest text-red-600">Entry Parameters</h2>
          </div>
          <form onSubmit={handleAdd} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">Customer Name</label>
                <input
                  required
                  className="w-full h-9 px-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none transition-colors"
                  value={formData.customerName}
                  onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">Project Name</label>
                <input
                  required
                  className="w-full h-9 px-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none transition-colors"
                  value={formData.projectName}
                  onChange={e => setFormData({ ...formData, projectName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">PI NUMBER</label>
                <input
                  required
                  className="w-full h-9 px-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none transition-colors"
                  value={formData.poNumber}
                  onChange={e => setFormData({ ...formData, poNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">PO Date</label>
                <input
                  type="date"
                  required
                  className="w-full h-9 px-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none transition-colors"
                  value={formData.poDate}
                  onChange={e => setFormData({ ...formData, poDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">SKU / TOTAL ARTICLES</label>
                <input
                  required
                  className="w-full h-9 px-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none transition-colors"
                  value={formData.articleName}
                  onChange={e => setFormData({ ...formData, articleName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">COLORS</label>
                <input
                  required
                  className="w-full h-9 px-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none transition-colors"
                  value={formData.color}
                  onChange={e => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">QUANTITY</label>
                <input
                  required
                  className="w-full h-9 px-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none transition-colors"
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">Order Date</label>
                <input
                  type="date"
                  required
                  className="w-full h-9 px-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none transition-colors"
                  value={formData.orderDate}
                  onChange={e => setFormData({ ...formData, orderDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-black uppercase tracking-widest">Dispatch Date</label>
                <input
                  type="date"
                  required
                  className="w-full h-9 px-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none transition-colors"
                  value={formData.dispatchDate}
                  onChange={e => setFormData({ ...formData, dispatchDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-black uppercase tracking-widest">Remarks</label>
              <textarea
                className="w-full p-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none transition-colors min-h-[80px]"
                value={formData.remark}
                onChange={e => setFormData({ ...formData, remark: e.target.value })}
              />
            </div>

            <Button type="submit" className="w-full h-10 text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-700">
              <PlusCircle className="w-4 h-4 mr-2" />
              + Add
            </Button>
          </form>
        </div>

        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden flex flex-col">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-sm font-black uppercase tracking-widest text-red-600">Preview Box</h2>
            <span className="text-[10px] font-mono text-emerald-600 font-bold uppercase tracking-widest">Queue: {previewList.length.toString().padStart(2, '0')}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-[400px]">
            {previewList.map((item, idx) => (
              <div key={item.id} className="p-4 border border-gray-100 rounded bg-gray-50 flex justify-between items-center group relative shadow-sm">
                <div className="flex-1">
                  <div className="flex justify-between items-start border-b border-gray-200 pb-2 mb-2">
                    <p className="text-sm font-black text-blue-700 uppercase tracking-tight">{item.projectName}</p>
                    <span className="text-[10px] font-mono text-gray-400 font-bold">ENTRY #{idx + 1}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    <p className="text-[10px] font-mono text-gray-700 uppercase"><span className="text-black font-black">CUSTOMER:</span> {item.customerName}</p>
                    <p className="text-[10px] font-mono text-gray-700 uppercase"><span className="text-black font-black">PO NO - TOTAL PIECES:</span> {item.poNumber}</p>
                    <p className="text-[10px] font-mono text-gray-700 uppercase"><span className="text-black font-black">PO DATE:</span> {item.poDate}</p>
                    <p className="text-[10px] font-mono text-gray-700 uppercase"><span className="text-black font-black">ARTICLE / TOTAL ARTICLES:</span> {item.articleName}</p>
                    <p className="text-[10px] font-mono text-gray-700 uppercase"><span className="text-black font-black">COLORS / TOTAL COLORS:</span> {item.color}</p>
                    <p className="text-[10px] font-mono text-gray-700 uppercase"><span className="text-black font-black">ORDER DT:</span> {item.orderDate}</p>
                    <p className="text-[10px] font-mono text-gray-700 uppercase"><span className="text-black font-black">DISPATCH:</span> {item.dispatchDate}</p>
                    {item.remark && <p className="text-[10px] font-mono text-gray-700 uppercase col-span-2"><span className="text-black font-black">REMARKS:</span> {item.remark}</p>}
                  </div>
                </div>
                <button 
                  onClick={() => setPreviewList(previewList.filter(p => p.id !== item.id))}
                  className="ml-4 p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {previewList.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                <FileText className="w-8 h-8 opacity-20" />
                <p className="text-[10px] font-mono uppercase tracking-widest">Queue Empty</p>
              </div>
            )}
          </div>
          <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
            <Button 
              onClick={() => setIsConfigOpen(true)}
              variant="outline"
              className="w-full h-10 text-xs font-bold uppercase tracking-widest border-blue-200 text-blue-600 hover:bg-blue-50"
            >
              <Settings className="w-4 h-4 mr-2" />
              Workflow Config
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || previewList.length === 0}
              className="w-full h-12 text-sm font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'PROCESSING...' : 'INITIALIZE PROCESS FLOWS'}
              {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isConfigOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-gray-900">Project Workflow Configuration</h2>
                  <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Customize steps for this requirement</p>
                </div>
                <button onClick={() => setIsConfigOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                {/* Left Side: Available Steps */}
                <div className="w-full lg:w-64 bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Available Steps</h3>
                    <button 
                      onClick={() => {
                        const allSteps = WORKFLOW_STEP_NAMES.map(name => {
                          const defaultStep = workflowConfig?.steps.find(s => s.name === name);
                          return {
                            name,
                            assignedToEmail: defaultStep?.assignedToEmail || '',
                            tat: defaultStep?.tat || 0,
                            plannedDate: ''
                          };
                        });
                        setCustomSteps(calculateDates(allSteps, formData.orderDate));
                        toast.success('All steps added to workflow');
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider flex items-center gap-1"
                    >
                      <PlusCircle className="w-3 h-3" />
                      Select All
                    </button>
                  </div>
                  <div className="space-y-2">
                    {WORKFLOW_STEP_NAMES.map((name) => (
                      <button
                        key={name}
                        onClick={() => {
                          const defaultStep = workflowConfig?.steps.find(s => s.name === name);
                          const newStep = { 
                            name, 
                            assignedToEmail: defaultStep?.assignedToEmail || '', 
                            tat: defaultStep?.tat || 0,
                            plannedDate: ''
                          };
                          const updated = calculateDates([...customSteps, newStep], formData.orderDate);
                          setCustomSteps(updated);
                        }}
                        className="w-full text-left p-3 bg-white border border-gray-200 rounded text-xs font-bold hover:border-blue-500 hover:text-blue-600 transition-all flex items-center justify-between group"
                      >
                        {name}
                        <PlusCircle className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Side: Configured Workflow */}
                <div className="flex-1 p-6 overflow-y-auto">
                  <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-200">
                          <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest w-16">Seq</th>
                          <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest">Process Step Name</th>
                          <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest w-24">TAT (Days)</th>
                          <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest w-32">Date</th>
                          <th className="px-4 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest w-16 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {customSteps.map((step, index) => (
                          <tr key={index} className="group">
                            <td className="px-4 py-3">
                              <div className="flex flex-col items-center gap-1">
                                <button 
                                  disabled={index === 0}
                                  onClick={() => {
                                    const newSteps = [...customSteps];
                                    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
                                    setCustomSteps(newSteps);
                                  }}
                                  className="p-0.5 text-gray-400 hover:text-blue-600 disabled:opacity-20"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <span className="text-xs font-mono text-gray-400">{(index + 1).toString().padStart(2, '0')}</span>
                                <button 
                                  disabled={index === customSteps.length - 1}
                                  onClick={() => {
                                    const newSteps = [...customSteps];
                                    [newSteps[index + 1], newSteps[index]] = [newSteps[index], newSteps[index + 1]];
                                    setCustomSteps(newSteps);
                                  }}
                                  className="p-0.5 text-gray-400 hover:text-blue-600 disabled:opacity-20"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-bold text-gray-900">{step.name}</span>
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type="number"
                                className="w-full h-8 px-2 text-xs border border-gray-200 rounded focus:border-blue-500 outline-none"
                                value={step.tat}
                                onChange={(e) => {
                                  const newSteps = [...customSteps];
                                  newSteps[index] = { ...newSteps[index], tat: parseInt(e.target.value) || 0 };
                                  setCustomSteps(calculateDates(newSteps, formData.orderDate));
                                }}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type="date"
                                className={`w-full h-8 px-2 text-xs border border-gray-200 rounded focus:border-blue-500 outline-none font-mono ${new Date(step.plannedDate).getDay() === 0 ? 'text-red-600 font-bold' : ''}`}
                                value={step.plannedDate}
                                onChange={(e) => {
                                  const newSteps = [...customSteps];
                                  newSteps[index] = { ...newSteps[index], plannedDate: e.target.value };
                                  setCustomSteps(newSteps);
                                }}
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button 
                                onClick={() => {
                                  const newSteps = customSteps.filter((_, i) => i !== index);
                                  setCustomSteps(calculateDates(newSteps, formData.orderDate));
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                title="Remove Step"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {customSteps.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-12 text-center text-gray-400 font-mono text-[10px] uppercase tracking-widest italic">
                              No steps added. Click on the left to add process steps.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (workflowConfig) setCustomSteps(workflowConfig.steps);
                    setIsConfigOpen(false);
                  }}
                  className="h-10 px-6 text-xs font-bold uppercase tracking-widest border-gray-200"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => setIsConfigOpen(false)}
                  className="h-10 px-8 text-xs font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-700"
                >
                  Apply Configuration
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProjectDetail = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { profile } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [remark, setRemark] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Project>>({});
  const navigate = useNavigate();

  useEffect(() => {
    if (!projectId) return;
    const fetchProject = async () => {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
      if (data) {
        setProject(data as Project);
        setEditData(data as Project);
      }
      setLoading(false);
    };
    fetchProject();

    const subscription = supabase
      .channel(`project_${projectId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, (payload) => {
        setProject(payload.new as Project);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [projectId]);

  const handleUpdateStep = async (status: StepStatus) => {
    if (!project || !projectId) return;
    setUpdating(true);
    try {
      const updatedSteps = [...project.steps];
      const currentStep = updatedSteps[project.current_step_index];
      
      currentStep.status = status;
      currentStep.actualDate = new Date().toISOString();
      currentStep.remark = remark;

      const nextStepIndex = project.current_step_index + 1;
      const isLastStep = nextStepIndex >= project.steps.length;

      const { error } = await supabase.from('projects').update({
        steps: updatedSteps,
        current_step_index: isLastStep ? project.current_step_index : nextStepIndex,
        status: isLastStep && status === 'Done' ? 'Completed' : 'Active'
      }).eq('id', projectId);

      if (error) throw error;

      toast.success(`Step marked as ${status}`);
      setRemark('');
      
      // Send Email Notification for next step
      const nextStep = updatedSteps[nextStepIndex];
      if (nextStep && status === 'Done') {
        await sendEmailNotification(nextStep.assignedToEmail, nextStep.name, project.project_name, 'update', projectId);
        toast.info(`Notification sent to ${nextStep.assignedToEmail} for next step: ${nextStep.name}`);
      }

      if (isLastStep && status === 'Done') {
        navigate('/');
      }
    } catch (error: any) {
      toast.error('Update failed: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateProjectDetails = async () => {
    if (!projectId || !editData) return;
    setUpdating(true);
    try {
      const { error } = await supabase.from('projects').update(editData).eq('id', projectId);
      if (error) throw error;
      toast.success('Project details updated');
      setIsEditing(false);
    } catch (error: any) {
      toast.error('Update failed: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <ProjectDetailSkeleton />;
  if (!project) return <div className="p-8">Project not found</div>;

  const currentStep = project.steps[project.current_step_index];
  const isAssigned = profile?.email === currentStep?.assignedToEmail;

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full shrink-0">
            <ChevronRight className="w-6 h-6 rotate-180" />
          </button>
          <div className="overflow-hidden">
            <h1 className="text-xl lg:text-3xl font-bold text-gray-900 truncate">{project.project_name}</h1>
            <p className="text-xs lg:text-sm text-gray-500 truncate uppercase tracking-widest font-mono">PI NUMBER: {project.po_number} | {project.customer_name}</p>
          </div>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="bg-white p-6 lg:p-8 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto no-scrollbar">
        <div className="flex items-center min-w-[1000px] pb-16">
          {project.steps.map((step, index) => (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center relative group">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10",
                  index < project.current_step_index ? "bg-emerald-500 border-emerald-500 text-white" :
                  index === project.current_step_index ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30 scale-110" :
                  "bg-white border-gray-200 text-gray-400"
                )}>
                  {index < project.current_step_index ? <Check className="w-6 h-6" /> : index + 1}
                </div>
                <div className="absolute top-12 text-center w-32">
                  <p className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    index === project.current_step_index ? "text-blue-600" : "text-gray-400"
                  )}>
                    {step.name}
                  </p>
                  <p className={cn(
                    "text-[9px] mt-0.5",
                    new Date(step.plannedDate).getDay() === 0 ? "text-red-600 font-black" : "text-gray-400"
                  )}>
                    PLN: {format(new Date(step.plannedDate), 'MMM dd')}
                  </p>
                  {step.actualDate && (
                    <p className="text-[9px] text-emerald-600 mt-0.5 font-bold">
                      ACT: {format(new Date(step.actualDate), 'MMM dd')}
                    </p>
                  )}
                </div>
              </div>
              {index < project.steps.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 mx-2",
                  index < project.current_step_index ? "bg-emerald-500" : "bg-gray-100"
                )} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Project Info</h2>
              {profile?.role === 'Admin' && (
                <button 
                  onClick={() => isEditing ? handleUpdateProjectDetails() : setIsEditing(true)}
                  className="text-[10px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-800"
                >
                  {isEditing ? '[ SAVE ]' : '[ EDIT ]'}
                </button>
              )}
            </div>
            <div className="space-y-3">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">SKU / Total Articles</label>
                    <input 
                      className="w-full h-8 px-2 text-xs border border-gray-200 rounded"
                      value={editData.article_name}
                      onChange={e => setEditData({...editData, article_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Colors</label>
                    <input 
                      className="w-full h-8 px-2 text-xs border border-gray-200 rounded"
                      value={editData.color}
                      onChange={e => setEditData({...editData, color: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Quantity</label>
                    <input 
                      className="w-full h-8 px-2 text-xs border border-gray-200 rounded"
                      value={editData.quantity}
                      onChange={e => setEditData({...editData, quantity: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">PI Number</label>
                    <input 
                      className="w-full h-8 px-2 text-xs border border-gray-200 rounded"
                      value={editData.po_number}
                      onChange={e => setEditData({...editData, po_number: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Remark</label>
                    <textarea 
                      className="w-full p-2 text-xs border border-gray-200 rounded min-h-[60px]"
                      value={editData.remark}
                      onChange={e => setEditData({...editData, remark: e.target.value})}
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full h-8 text-[10px] font-bold uppercase"
                    onClick={() => {
                      setIsEditing(false);
                      setEditData(project);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <InfoRow label="SKU / Total Articles" value={project.article_name} />
                  <InfoRow label="Colors" value={project.color} />
                  <InfoRow label="Quantity" value={project.quantity} />
                  <InfoRow label="PO Date" value={project.po_date ? format(new Date(project.po_date), 'PPP') : 'N/A'} />
                  <InfoRow label="Order Date" value={project.order_date ? format(new Date(project.order_date), 'PPP') : 'N/A'} />
                  <InfoRow label="Dispatch Date" value={project.dispatch_date ? format(new Date(project.dispatch_date), 'PPP') : 'N/A'} />
                  <InfoRow label="Merchandiser" value={project.merchandiser_name} />
                  <div className="pt-4 border-t border-gray-50">
                    <p className="text-xs font-semibold text-gray-400 uppercase">Remark</p>
                    <p className="text-sm text-gray-600 mt-1">{project.remark || 'No remarks'}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            {project.status === 'Active' && isAssigned ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white p-8 rounded border border-gray-200 shadow-sm space-y-6 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-50 p-3 rounded text-blue-600 border border-blue-100">
                      <Activity className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase">COMMAND CENTER: {currentStep.name}</h2>
                      <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">PLANNED_COMPLETION: {format(new Date(currentStep.plannedDate), 'PPP')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-mono text-blue-600 font-bold uppercase tracking-widest">Awaiting Input</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Process Remark / Log Entry</label>
                    <textarea 
                      className="w-full rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-600 min-h-[120px] mt-2"
                      placeholder="ENTER PROCESS LOGS HERE..."
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      variant="outline" 
                      className="h-12 border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold uppercase tracking-widest"
                      onClick={() => handleUpdateStep('Not Done')}
                      disabled={updating}
                    >
                      [ ABORT / NOT DONE ]
                    </Button>
                    <Button 
                      className="h-12 bg-blue-600 hover:bg-blue-700 text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-600/20"
                      onClick={() => handleUpdateStep('Done')}
                      disabled={updating}
                    >
                      [ COMMIT / MARK DONE ]
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-gray-50 p-8 rounded-2xl border border-dashed border-gray-200 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-500">
                  {project.status === 'Completed' ? "Project Completed" : `Waiting for ${currentStep?.assignedToEmail}`}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {project.status === 'Completed' ? "All steps have been successfully processed." : "You will be notified when it's your turn."}
                </p>
              </div>
            )}
          </AnimatePresence>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold">Step History</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {project.steps.map((step, i) => (
                <div key={i} className={cn(
                  "p-6 flex items-start gap-4",
                  step.status === 'Done' ? "bg-emerald-50/30" : ""
                )}>
                  <div className={cn(
                    "mt-1 p-1 rounded-full",
                    step.status === 'Done' ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"
                  )}>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-gray-900">{step.name}</h4>
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                        step.status === 'Done' ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                      )}>
                        {step.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Assigned to: {step.assignedToEmail}</p>
                    {step.remark && <p className="text-sm text-gray-600 mt-2 italic">"{step.remark}"</p>}
                    <div className="flex gap-4 mt-3">
                      <div className={cn(
                        "flex items-center gap-1 text-[10px]",
                        new Date(step.plannedDate).getDay() === 0 ? "text-red-600 font-black" : "text-gray-400"
                      )}>
                        <Calendar className="w-3 h-3" />
                        Planned: {format(new Date(step.plannedDate), 'MMM dd')}
                      </div>
                      {step.actualDate && (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Actual: {format(new Date(step.actualDate), 'MMM dd, HH:mm')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({ label, value }: { label: string, value: string }) => (
  <div className="flex justify-between items-center py-2">
    <span className="text-xs font-semibold text-gray-400 uppercase">{label}</span>
    <span className="text-sm font-medium text-gray-900">{value}</span>
  </div>
);

const WorkflowConfigView = () => {
  const [steps, setSteps] = useState<WorkflowConfigStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from('config').select('*').eq('id', 'workflow').single();
      
      // Always base the list on WORKFLOW_STEP_NAMES to ensure names are up to date
      const initialSteps = WORKFLOW_STEP_NAMES.map(name => {
        if (data) {
          const saved = (data.data.steps as WorkflowConfigStep[]).find(s => s.name === name);
          if (saved) return saved;
        }
        return {
          name,
          assignedToEmail: '',
          tat: 0
        };
      });
      
      setSteps(initialSteps);
      setLoading(false);
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('config').upsert({ id: 'workflow', data: { steps } });
      if (error) throw error;
      toast.success('Workflow configuration saved');
    } catch (error: any) {
      toast.error('Save failed: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <WorkflowSkeleton />;

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8 bg-[#F8F9FA] min-h-screen">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            WORKFLOW ENGINE CONFIGURATION
          </h1>
          <p className="text-xs text-gray-500 font-mono mt-1 uppercase tracking-widest">Process Definition Module</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
          <Button 
            variant="outline"
            onClick={() => {
              const initialSteps = WORKFLOW_STEP_NAMES.map(name => ({
                name,
                assignedToEmail: '',
                tat: 0
              }));
              setSteps(initialSteps);
              toast.info('Steps reset to default list. Click "COMMIT CHANGES" to save.');
            }}
            className="flex-1 lg:flex-none h-10 px-4 lg:px-6 text-[10px] lg:text-xs font-bold uppercase tracking-wider border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Reset to Default
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving}
            className="flex-1 lg:flex-none h-10 px-4 lg:px-6 text-[10px] lg:text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20"
          >
            {saving ? 'SYNCHRONIZING...' : 'COMMIT CHANGES'}
          </Button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded shadow-lg overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-black">
              <th className="px-6 py-4 text-[11px] font-black text-black uppercase tracking-widest">Sequence</th>
              <th className="px-6 py-4 text-[11px] font-black text-black uppercase tracking-widest">Process Step Name</th>
              <th className="px-6 py-4 text-[11px] font-black text-black uppercase tracking-widest">Default Assignee (Email)</th>
              <th className="px-6 py-4 text-[11px] font-black text-black uppercase tracking-widest">TAT (Days)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {steps.map((step, index) => (
              <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <span className="text-xs font-mono text-gray-400">{(index + 1).toString().padStart(2, '0')}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-bold text-gray-900">{step.name}</span>
                </td>
                <td className="px-6 py-4">
                  <input 
                    type="email"
                    placeholder="Enter assignee email..."
                    className="w-full h-9 px-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none transition-colors"
                    value={step.assignedToEmail}
                    onChange={(e) => {
                      const newSteps = [...steps];
                      newSteps[index] = { ...newSteps[index], assignedToEmail: e.target.value.trim() };
                      setSteps(newSteps);
                    }}
                  />
                </td>
                <td className="px-6 py-4">
                  <input 
                    type="number"
                    className="w-24 h-9 px-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none transition-colors"
                    value={step.tat}
                    onChange={(e) => {
                      const newSteps = [...steps];
                      newSteps[index] = { ...newSteps[index], tat: parseInt(e.target.value) || 0 };
                      setSteps(newSteps);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
};

const Profile = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    team: profile?.team || 'Domestic' as Team
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        team: profile.team || 'Domestic' as Team
      });
    }
  }, [profile]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          team: profile.role === 'Merchandiser' ? formData.team : undefined
        })
        .eq('uid', profile.uid);

      if (error) throw error;
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error('Update failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 lg:space-y-8 bg-[#F8F9FA] min-h-screen">
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <UserIcon className="w-6 h-6 text-blue-600" />
          USER PROFILE SETTINGS
        </h1>
        <p className="text-xs text-gray-500 font-mono mt-1 uppercase tracking-widest">Identity Management Module</p>
      </div>

      <div className="max-w-xl bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-600 font-bold text-lg shrink-0">
            {profile?.first_name?.[0] || '?'}{profile?.last_name?.[0] || '?'}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-gray-900 truncate">{profile?.email}</p>
            <p className="text-[10px] text-blue-600 font-mono uppercase tracking-widest truncate">SYSTEM_UID: {profile?.uid?.slice(0, 8)}...</p>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-black uppercase tracking-widest">First Name</label>
              <input
                required
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none transition-colors"
                value={formData.firstName}
                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-black uppercase tracking-widest">Last Name</label>
              <input
                required
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none transition-colors"
                value={formData.lastName}
                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-black uppercase tracking-widest">Assigned Role</label>
            <div className="w-full h-9 px-3 text-sm border border-gray-200 rounded bg-gray-50 flex items-center text-gray-500 font-mono">
              {profile?.role?.toUpperCase() || 'NO_ROLE_ASSIGNED'}
            </div>
          </div>

          {profile?.role === 'Merchandiser' && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-black uppercase tracking-widest">Team Assignment</label>
              <select
                className="w-full h-9 px-3 text-sm border border-gray-200 rounded focus:border-blue-500 outline-none transition-colors"
                value={formData.team}
                onChange={e => setFormData({ ...formData, team: e.target.value as Team })}
              >
                <option value="Export">Export</option>
                <option value="Domestic">Domestic</option>
              </select>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full h-10 text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-700">
            {loading ? 'SYNCHRONIZING...' : 'UPDATE IDENTITY RECORD'}
          </Button>
        </form>
      </div>
    </div>
  );
};

// --- App Wrapper ---

const AppContent = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isSupabaseConfigured = 
    import.meta.env.VITE_SUPABASE_URL && 
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    !import.meta.env.VITE_SUPABASE_URL.includes('your-project');

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-red-100 text-center">
          <div className="bg-red-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Configuration Required</h2>
          <p className="mt-4 text-gray-600">
            Please set your Supabase credentials in the <strong>Secrets</strong> panel:
          </p>
          <ul className="mt-4 text-left text-sm space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-100">
            <li><code className="bg-gray-200 px-1 rounded">VITE_SUPABASE_URL</code></li>
            <li><code className="bg-gray-200 px-1 rounded">VITE_SUPABASE_ANON_KEY</code></li>
          </ul>
          <p className="mt-6 text-xs text-gray-400">
            After setting the secrets, the application will automatically refresh.
          </p>
        </div>
      </div>
    );
  }

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (loading && !user) return <LoadingScreen />;

  if (!user) {
    if (location.pathname === '/signup') return <SignUp />;
    return <Login />;
  }

  return (
    <div className="flex bg-[#F1F5F9] min-h-screen font-sans overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Mobile Header */}
        <div className="lg:hidden h-14 bg-[#0F172A] text-white flex items-center justify-between px-4 shrink-0 z-30 shadow-lg">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-300 hover:text-white"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">GINZA FMS</span>
              <span className="text-[8px] text-blue-400 font-mono uppercase tracking-widest">Monitoring</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs">
            {profile?.first_name?.[0] || '?'}{profile?.last_name?.[0] || '?'}
          </div>
        </div>

        {/* System Status Bar */}
        <div className="h-10 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-4 lg:gap-6 whitespace-nowrap">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] lg:text-[10px] font-bold text-gray-500 uppercase tracking-widest">System Operational</span>
            </div>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-gray-400" />
              <span className="text-[9px] lg:text-[10px] font-mono text-gray-400 uppercase">{format(new Date(), 'HH:mm:ss')} UTC</span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <div className="h-4 w-px bg-gray-200 mr-2" />
              <Activity className="w-3 h-3 text-blue-500" />
              <span className="text-[9px] lg:text-[10px] font-mono text-gray-500 uppercase tracking-widest">Load: 12%</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4 whitespace-nowrap">
            <div className="flex items-center gap-2 px-2 py-0.5 bg-blue-50 border border-blue-100 rounded">
              <span className="text-[9px] font-bold text-blue-600 uppercase tracking-tighter">Node: {location.pathname.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] lg:text-[10px] font-bold text-gray-400 uppercase tracking-widest">V2.1.0-PRO</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new-entry" element={(profile?.role === 'Merchandiser' || profile?.role === 'Admin') ? <NewEntry /> : <Navigate to="/" />} />
            <Route path="/config" element={profile?.role === 'Admin' ? <WorkflowConfigView /> : <Navigate to="/" />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/project/:projectId" element={<ProjectDetail />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const lastFetchedUid = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const handleAuth = async (session: any) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        if (currentUser.id !== lastFetchedUid.current) {
          await fetchProfile(currentUser.id, currentUser);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    };

    // Initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuth(session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleAuth(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (uid: string, currentUser?: any) => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    if (uid === lastFetchedUid.current && profile) return;
    lastFetchedUid.current = uid;
    
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('uid', uid).maybeSingle();
      
      if (data) {
        setProfile(data as UserProfile);
      } else if ((currentUser?.email || user?.email) === 'mis.mumbai@ginzalimited.com') {
        // Auto-assign Admin role for the primary user if profile is missing
        const adminProfile: UserProfile = {
          uid,
          email: (currentUser?.email || user?.email)!,
          first_name: 'Admin',
          last_name: 'User',
          role: 'Admin'
        };
        setProfile(adminProfile);
        // Optionally try to create the profile in DB
        await supabase.from('profiles').upsert([adminProfile]);
      }
      
      if (error) {
        console.error('Error fetching profile:', error);
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      <Router>
        <AppContent />
        <Toaster position="top-right" richColors />
      </Router>
    </AuthContext.Provider>
  );
}
