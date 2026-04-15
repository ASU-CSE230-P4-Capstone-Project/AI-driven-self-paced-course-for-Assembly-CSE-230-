'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, User, GraduationCap } from 'lucide-react';

export function RegisterPage() {
  const router = useRouter();
  const { register, user, isAuthenticated } = useAuth();
  
  const [userType, setUserType] = useState<'student' | 'professor' | null>(null);
  const [registeredRole, setRegisteredRole] = useState<string | null>(null);

  // Redirect after successful registration based on role
  useEffect(() => {
    if (isAuthenticated && user && registeredRole) {
      if (registeredRole === 'professor') {
        router.push('/login/teacher');
      } else {
        router.push('/login/student');
      }
    }
  }, [user, isAuthenticated, registeredRole, router]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    sisUserId: '',
    password: '',
    confirmPassword: '',
    professorKey: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateAsuEmail = (email: string): boolean => {
    return validateEmail(email) && email.trim().toLowerCase().endsWith("@asu.edu");
  };

  const validateSisId = (sis: string): boolean => {
    const s = sis.trim();
    return /^\d{10}$/.test(s);
  };

  const validatePassword = (password: string): boolean => {
    // Password must be at least 8 characters
    return password.length >= 8;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors
    const newErrors: Record<string, string> = {};

    // Validate all fields
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required.';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!validateAsuEmail(formData.email)) {
      newErrors.email = 'Please enter your official ASU email (@asu.edu).';
    }

    if (!formData.sisUserId.trim()) {
      newErrors.sisUserId = 'ASU ID (10-digit) is required.';
    } else if (!validateSisId(formData.sisUserId)) {
      newErrors.sisUserId = 'ASU ID must be a 10-digit number.';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.';
    } else if (!validatePassword(formData.password)) {
      newErrors.password = 'Password must be at least 8 characters long.';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    // Validate professor key if professor is selected
    if (userType === 'professor') {
      if (!formData.professorKey.trim()) {
        newErrors.professorKey = 'Professor key is required.';
      } else if (formData.professorKey !== 'PROF2024') {
        newErrors.professorKey = 'Invalid professor key.';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    // Attempt to register
    const role = userType === 'professor' ? 'professor' : 'student';
    const result = await register(formData.name, formData.email, formData.sisUserId, formData.password, role);

    if (result.success) {
      setRegisteredRole(role);
      // Redirect is handled by useEffect watching user state
    } else {
      // Show error
      setErrors({ general: result.error || 'Registration failed.' });
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-[#800020] px-6 py-4 shadow-md">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-400 h-10 w-10 rounded flex items-center justify-center">
              <span className="text-[#800020] font-bold text-lg">CSE</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">CSE 230 Computer Systems</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4 py-8">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-3xl font-bold text-gray-900">Arizona State University</h1>
            <p className="text-gray-600">CSE 230: Computer Org/Assemb Lang Prog</p>
          </div>
          <Card className="border-2 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle>Create an account</CardTitle>
            <CardDescription>
              Enter your information to create your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors.general && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.general}</AlertDescription>
                </Alert>
              )}

              {!userType ? (
                <div className="space-y-3">
                  <Label>I am a:</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-24 flex flex-col gap-2"
                      onClick={() => setUserType('student')}
                    >
                      <User className="h-8 w-8" />
                      <span>Student</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-24 flex flex-col gap-2"
                      onClick={() => setUserType('professor')}
                    >
                      <GraduationCap className="h-8 w-8" />
                      <span>Professor</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      {userType === 'student' ? (
                        <User className="h-5 w-5 text-primary" />
                      ) : (
                        <GraduationCap className="h-5 w-5 text-primary" />
                      )}
                      <span className="capitalize">{userType}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setUserType(null)}
                    >
                      Change
                    </Button>
                  </div>

                  {userType === 'professor' && (
                    <div className="space-y-2">
                      <Label htmlFor="professorKey">Professor Key</Label>
                      <Input
                        id="professorKey"
                        type="password"
                        placeholder="Enter professor key"
                        value={formData.professorKey}
                        onChange={(e) => handleInputChange('professorKey', e.target.value)}
                        disabled={isLoading}
                      />
                      {errors.professorKey && (
                        <p className="text-sm text-red-600">{errors.professorKey}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        Contact your administrator for the professor key
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="First Last"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      disabled={isLoading}
                    />
                    {errors.name && (
                      <p className="text-sm text-red-600">{errors.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">ASU Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="asurite@asu.edu"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      disabled={isLoading}
                    />
                    {errors.email && (
                      <p className="text-sm text-red-600">{errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sisUserId">ASU ID (10-digit)</Label>
                    <Input
                      id="sisUserId"
                      type="text"
                      inputMode="numeric"
                      placeholder="ASU ID (10 digits)"
                      value={formData.sisUserId}
                      onChange={(e) => handleInputChange('sisUserId', e.target.value)}
                      disabled={isLoading}
                    />
                    {errors.sisUserId && (
                      <p className="text-sm text-red-600">{errors.sisUserId}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      disabled={isLoading}
                    />
                    {errors.password && (
                      <p className="text-sm text-red-600">{errors.password}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Must be at least 8 characters long
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      disabled={isLoading}
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-red-600">{errors.confirmPassword}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full bg-[#800020] hover:bg-[#91173b] text-white" disabled={isLoading}>
                    {isLoading ? 'Creating account...' : 'Sign Up'}
                  </Button>

                  <div className="text-center text-sm text-gray-600">
                    Already have an account?{' '}
                    <Link href="/login" className="text-[#800020] hover:underline font-medium">
                      Sign in
                    </Link>
                  </div>
                </>
              )}
            </form>
          </CardContent>
        </Card>
        </div>
      </main>
    </div>
  );
}
