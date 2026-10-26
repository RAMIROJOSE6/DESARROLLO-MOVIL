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

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  // Estados del formulario
  const [fullName, setFullName] = useState('');
  const [cedula, setCedula] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Riohacha');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Visibilidad de contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Aceptación de términos
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Estado de carga o éxito
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const showNotification = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, message, [{ text: 'Aceptar', onPress: onOk }]);
    }
  };

  const handleRegister = async () => {
    if (!fullName.trim()) {
      showNotification('Campo requerido', 'Por favor ingresa tu nombre completo.');
      return;
    }
    if (!cedula.trim()) {
      showNotification('Campo requerido', 'Por favor ingresa tu número de cédula o documento.');
      return;
    }
    if (!email.trim()) {
      showNotification('Campo requerido', 'Por favor ingresa tu correo electrónico.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showNotification('Correo inválido', 'Por favor ingresa un correo electrónico válido (ejemplo: usuario@correo.com).');
      return;
    }
    if (!phone.trim()) {
      showNotification('Campo requerido', 'Por favor ingresa tu teléfono de contacto o WhatsApp.');
      return;
    }
    if (!password) {
      showNotification('Campo requerido', 'Por favor ingresa una contraseña.');
      return;
    }
    if (password.length < 6) {
      showNotification('Contraseña corta', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      showNotification('Las contraseñas no coinciden', 'Por favor verifica que ambas contraseñas coincidan exactamente.');
      return;
    }
    if (!agreeTerms) {
      showNotification('Términos y condiciones', 'Debes aceptar los términos y la política de tratamiento de datos para crear tu cuenta en Einuushi.');
      return;
    }

    setIsSubmitting(true);
    const res = await register({
      fullName: fullName.trim(),
      cedula: cedula.trim(),
      email: email.trim(),
      phone: phone.trim(),
      city: city.trim() || 'Riohacha',
      password: password,
    });
    setIsSubmitting(false);

    if (res.success) {
      setIsSuccess(true);
    } else {
      showNotification('Error al registrar', res.message || 'No se pudo completar el registro.');
    }
  };

  const handleFinishRegistration = () => {
    showNotification(
      '¡Bienvenido a Einuushi!',
      `Tu cuenta ha sido creada exitosamente a nombre de ${fullName.trim()}.`,
      () => {
        router.replace('/home');
      }
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="dark" />

      {/* Cabecera uniforme con la línea de diseño de la app */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
        >
          <Ionicons name="arrow-back" size={20} color="#1E2B58" />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerSubtitle}>Artesanías de Riohacha</Text>
          <Text style={styles.headerTitle}>CREAR CUENTA NUEVA</Text>
        </View>
      </View>

      <ScrollView
        style={[
          styles.scrollView,
          Platform.OS === 'web' && ({
            overflowY: 'scroll',
            scrollbarWidth: 'thin',
            scrollbarColor: '#C5A880 #F1F5F9',
          } as any),
        ]}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={true}
        indicatorStyle="black"
        nestedScrollEnabled={true}
      >
        {/* Cabecera con Logo Oficial */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/logo_einuushi.jpeg')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Título de Bienvenida */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>Registro de Clientes</Text>
          <Text style={styles.welcomeSubtitle}>
            Únete a Einuushi y accede a colecciones exclusivas de mochilas, mantas y chinchorros wayuu
          </Text>
        </View>

        {/* Banner Informativo con la línea gráfica de home.tsx */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTag}>FAMILIA EINUUSHI</Text>
            <Text style={styles.bannerTitle}>Hecho a Mano con Amor</Text>
            <Text style={styles.bannerSubtitle}>Directamente desde Riohacha, La Guajira</Text>
          </View>
          <View style={styles.bannerIconBox}>
            <Ionicons name="sparkles" size={26} color="#C5A880" />
          </View>
        </View>

        {isSuccess ? (
          /* Tarjeta de Éxito */
          <View style={styles.successCard}>
            <View style={styles.successIconBox}>
              <Ionicons name="checkmark-done" size={44} color="#166534" />
            </View>
            <Text style={styles.successTitle}>¡Cuenta Creada Exitosamente!</Text>
            <Text style={styles.successDesc}>
              Estimado/a <Text style={{ fontWeight: 'bold', color: '#1E2B58' }}>{fullName}</Text>, tu registro ha finalizado con éxito con el correo{' '}
              <Text style={{ fontWeight: 'bold', color: '#1E2B58' }}>{email}</Text>.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleFinishRegistration}
            >
              <Text style={styles.primaryButtonText}>INGRESAR A LA TIENDA</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, { marginTop: 12 }]}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.secondaryButtonText}>Ir al Inicio de Sesión</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Formulario */
          <View style={styles.formContainer}>
            {/* Nombre Completo */}
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#1E2B58" style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                ]}
                placeholder="Nombre Completo *"
                placeholderTextColor="#94A3B8"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            {/* Cédula o Documento */}
            <View style={styles.inputWrapper}>
              <Ionicons name="card-outline" size={20} color="#1E2B58" style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                ]}
                placeholder="Cédula / NIT * (Solo números)"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={cedula}
                onChangeText={(val) => setCedula(val.replace(/[^0-9]/g, ''))}
              />
            </View>

            {/* Correo Electrónico */}
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#1E2B58" style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                ]}
                placeholder="Correo Electrónico *"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Teléfono / WhatsApp */}
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={20} color="#1E2B58" style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                ]}
                placeholder="Teléfono / WhatsApp * (Solo números)"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(val) => setPhone(val.replace(/[^0-9]/g, ''))}
              />
            </View>

            {/* Ciudad */}
            <View style={styles.inputWrapper}>
              <Ionicons name="location-outline" size={20} color="#1E2B58" style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                ]}
                placeholder="Ciudad (Ej. Riohacha)"
                placeholderTextColor="#94A3B8"
                value={city}
                onChangeText={setCity}
              />
            </View>

            {/* Contraseña */}
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#1E2B58" style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                ]}
                placeholder="Contraseña (mínimo 6 caracteres) *"
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

            {/* Confirmar Contraseña */}
            <View style={styles.inputWrapper}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#1E2B58" style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                ]}
                placeholder="Confirmar Contraseña *"
                placeholderTextColor="#94A3B8"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            {/* Aceptación de términos */}
            <TouchableOpacity
              style={styles.termsRow}
              activeOpacity={0.8}
              onPress={() => setAgreeTerms(!agreeTerms)}
            >
              <View style={[styles.checkbox, agreeTerms && styles.checkboxActive]}>
                {agreeTerms && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
              </View>
              <Text style={styles.termsText}>
                Acepto los <Text style={styles.termsTextBold}>Términos del Servicio</Text> y la <Text style={styles.termsTextBold}>Política de Privacidad</Text> de Einuushi.
              </Text>
            </TouchableOpacity>

            {/* Botón de Acción Principal */}
            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={isSubmitting}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'REGISTRANDO...' : 'REGISTRARME EN EINUUSHI'}
              </Text>
            </TouchableOpacity>

            {/* Enlaces inferiores */}
            <View style={styles.linksContainer}>
              <Text style={styles.linkText}>¿Ya tienes una cuenta?</Text>
              <TouchableOpacity
                style={{ marginTop: 6 }}
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/');
                  }
                }}
              >
                <Text style={styles.linkTextBold}>Iniciar Sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: '#C5A880',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#C5A880',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#64748B',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E2B58',
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    paddingBottom: 60,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 240,
    height: 100,
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E2B58',
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  bannerCard: {
    backgroundColor: '#1E2B58',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
    borderWidth: 1.5,
    borderColor: '#C5A880',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTag: {
    fontSize: 9,
    color: '#C5A880',
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#E2E8F0',
  },
  bannerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C5A880',
    marginLeft: 10,
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
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#C5A880',
    backgroundColor: '#FFFFFF',
    marginRight: 10,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#1E2B58',
    borderColor: '#1E2B58',
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  termsTextBold: {
    color: '#1E2B58',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#1E2B58',
    borderWidth: 1.5,
    borderColor: '#C5A880',
    borderRadius: 30,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#C5A880',
    borderRadius: 30,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1E2B58',
    fontSize: 13,
    fontWeight: '600',
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
    fontSize: 13,
    color: '#1E2B58',
    fontWeight: '600',
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#C5A880',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  successIconBox: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#DCFCE7',
    borderWidth: 2,
    borderColor: '#166534',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 8,
    textAlign: 'center',
  },
  successDesc: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 10,
  },
  footerText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
});
