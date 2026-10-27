import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  Image,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showNotification = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message, [{ text: 'Aceptar' }]);
    }
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showNotification('Campo requerido', 'Por favor ingresa tu correo electrónico.');
      return;
    }
    if (!password) {
      showNotification('Campo requerido', 'Por favor ingresa tu contraseña.');
      return;
    }

    setIsSubmitting(true);
    const res = await login(trimmedEmail, password);
    setIsSubmitting(false);

    if (res.success) {
      if (res.user?.role === 'driver') {
        router.replace('/driver');
      } else {
        router.replace('/home');
      }
    } else {
      showNotification('Acceso Denegado', res.message || 'Credenciales incorrectas.');
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <ScrollView 
        contentContainerStyle={styles.scrollContainer} 
        showsVerticalScrollIndicator={true}
      >
        
        {/* Cabecera con el Logo Oficial */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/images/logo_einuushi.jpeg')} 
            style={styles.logoImage} 
            resizeMode="contain"
          />
        </View>

        {/* Título de Bienvenida */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>¡Bienvenido/a!</Text>
          <Text style={styles.welcomeSubtitle}>Artesanías auténticas desde Riohacha-La Guajira</Text>
        </View>

        {/* Formulario de Acceso */}
        <View style={styles.formContainer}>
          
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color="#1E2B58" style={styles.inputIcon} />
            <TextInput
              style={[
                styles.input,
                Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
              ]}
              placeholder="Correo Electrónico"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color="#1E2B58" style={styles.inputIcon} />
            <TextInput
              style={[
                styles.input,
                Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
              ]}
              placeholder="Contraseña"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons 
                name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                size={20} 
                color="#64748B" 
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.loginButton, isSubmitting && { opacity: 0.7 }]} 
            onPress={handleLogin}
            disabled={isSubmitting}
          >
            <Text style={styles.loginButtonText}>
              {isSubmitting ? 'VALIDANDO...' : 'INICIAR SESIÓN'}
            </Text>
          </TouchableOpacity>

          <View style={styles.linksContainer}>
            <TouchableOpacity onPress={() => router.push('/forgot-password')}>
              <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 14 }} onPress={() => router.push('/register')}>
              <Text style={styles.linkTextBold}>Crear cuenta nueva</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{
                marginTop: 18,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F8FAFC',
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#CBD5E1',
              }}
              onPress={() => router.push('/driver')}
              activeOpacity={0.8}
            >
              <Ionicons name="bicycle" size={17} color="#1E2B58" style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 12, color: '#1E2B58', fontWeight: 'bold' }}>
                Portal de Repartidores & Envíos ➔
              </Text>
            </TouchableOpacity>
          </View>

        </View>

        {/* Footer Oficial */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>By Fannys Cotes - Riohacha</Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFBFA',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 260,  
    height: 110, 
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E2B58',
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#C5A880',
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
  },
  eyeIcon: {
    padding: 6,
  },
  loginButton: {
    backgroundColor: '#1E2B58',
    borderWidth: 1.5,
    borderColor: '#C5A880',
    borderRadius: 30,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  linksContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  linkText: {
    fontSize: 13,
    color: '#64748B',
  },
  linkTextBold: {
    fontSize: 14,
    color: '#1E2B58',
    fontWeight: '700',
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  footerText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});