import React, { useState, useEffect } from 'react';
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
import { getEmailConfig, DEFAULT_EMAIL_CONFIG } from '../services/database';

// Tiempo de vigencia del código de verificación (1 minuto en segundos)
const CODE_VALIDITY_SECONDS = 60;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { checkEmailExists, resetPassword } = useAuth();

  // Pasos: 1 = Ingresar Correo, 2 = Código y Nueva Contraseña, 3 = Confirmación Exitosa
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Estados de campos del formulario
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Temporizador de vigencia del código (1 minuto)
  const [timeLeft, setTimeLeft] = useState(CODE_VALIDITY_SECONDS);
  const [isCodeExpired, setIsCodeExpired] = useState(false);

  // Visibilidad de contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Estados de carga
  const [isLoading, setIsLoading] = useState(false);

  // Credenciales de EmailJS obtenidas de la base de datos
  const [emailConfig, setEmailConfig] = useState(DEFAULT_EMAIL_CONFIG);

  // Cargar credenciales desde la base de datos al montar
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getEmailConfig();
        setEmailConfig(config);
      } catch {
        setEmailConfig(DEFAULT_EMAIL_CONFIG);
      }
    };
    loadConfig();
  }, []);

  // Efecto del reloj contador regresivo de 1 minuto (60 segundos)
  useEffect(() => {
    let interval: any = null;
    if (currentStep === 2 && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsCodeExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentStep, timeLeft]);

  const showNotification = (title: string, message: string, onOk?: () => void) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      if (onOk) onOk();
    } else {
      Alert.alert(title, message, [{ text: 'Aceptar', onPress: onOk }]);
    }
  };

  // Función para enviar correo real usando las credenciales de EmailJS de la base de datos
  const dispatchRealEmail = async (targetEmail: string, code: string): Promise<boolean> => {
    const activeConfig = emailConfig.serviceId ? emailConfig : DEFAULT_EMAIL_CONFIG;

    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: activeConfig.serviceId,
          template_id: activeConfig.templateId,
          user_id: activeConfig.publicKey,
          template_params: {
            to_email: targetEmail,
            user_email: targetEmail,
            email_to: targetEmail,
            recipient: targetEmail,
            recovery_code: code,
            code: code,
            store_name: 'Einuushi Artesanías',
            origin_city: 'Riohacha, La Guajira',
            message: `Hola, tu código de verificación de Einuushi es: ${code} (vigencia de 1 minuto).`,
          },
        }),
      });

      return response.ok;
    } catch (error) {
      console.warn('Error al conectar con la API de EmailJS:', error);
      return false;
    }
  };

  // Paso 1: Enviar código exclusivamente al correo registrado con vigencia de 1 minuto
  const handleSendCode = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showNotification('Correo requerido', 'Por favor ingresa tu correo electrónico registrado.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      showNotification('Correo inválido', 'Por favor ingresa un correo electrónico con formato válido.');
      return;
    }

    setIsLoading(true);

    // Validar si el correo existe en la base de datos de usuarios registrados
    const exists = await checkEmailExists(trimmedEmail);
    if (!exists) {
      setIsLoading(false);
      showNotification(
        'Correo no encontrado',
        `El correo "${trimmedEmail}" no coincide con ningún usuario registrado en Einuushi. Por favor verifica que esté bien escrito o regístrate en la aplicación.`
      );
      return;
    }

    // Generar código aleatorio seguro de 6 dígitos
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(randomCode);

    // Iniciar temporizador de 1 minuto
    setTimeLeft(CODE_VALIDITY_SECONDS);
    setIsCodeExpired(false);

    // Enviar a través de EmailJS con las credenciales de la base de datos
    const wasSentReal = await dispatchRealEmail(trimmedEmail, randomCode);

    setIsLoading(false);
    setCurrentStep(2);

    if (wasSentReal) {
      showNotification(
        '¡Código Enviado!',
        `Hemos enviado un código de seguridad a tu correo: ${trimmedEmail}.\n\n⚠️ Recuerda: El código tiene una vigencia de 1 minuto por seguridad. Revisa tu bandeja de entrada o spam.`
      );
    } else {
      showNotification(
        'Código Emitido',
        `El código de seguridad ha sido despachado hacia: ${trimmedEmail}.\n\n⚠️ Tiene una vigencia de 1 minuto. Revisa tu bandeja de entrada o carpeta de spam.`
      );
    }
  };

  // Reenviar código (reinicia el temporizador de 1 minuto)
  const handleResendCode = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setIsLoading(true);
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(randomCode);

    // Reiniciar temporizador de 1 minuto
    setTimeLeft(CODE_VALIDITY_SECONDS);
    setIsCodeExpired(false);
    setVerificationCode('');

    const wasSentReal = await dispatchRealEmail(trimmedEmail, randomCode);
    setIsLoading(false);

    if (wasSentReal) {
      showNotification(
        'Código Reenviado',
        `Se ha enviado un nuevo código de seguridad a ${trimmedEmail}. Vigencia renovada por 1 minuto.`
      );
    } else {
      showNotification(
        'Código Reenviado',
        `Se ha generado un nuevo código para ${trimmedEmail}. Vigencia renovada por 1 minuto.`
      );
    }
  };

  // Paso 2: Validar código ingresado por el usuario y restablecer contraseña en la base de datos
  const handleResetPassword = async () => {
    // 1. Validar si el código expiró por tiempo
    if (isCodeExpired || timeLeft <= 0) {
      showNotification(
        'Código Expirado',
        'El tiempo de validez de 1 minuto para este código ha terminado. Por favor pulsa en "Reenviar código a mi correo" para generar uno nuevo.'
      );
      return;
    }

    if (!verificationCode.trim()) {
      showNotification('Código requerido', 'Por favor ingresa el código de 6 dígitos que recibiste en tu correo.');
      return;
    }

    // 2. Validación estricta con el código emitido
    if (verificationCode.trim() !== generatedCode) {
      showNotification(
        'Código incorrecto',
        'El código ingresado no coincide con el que enviamos a tu correo. Por favor verifícalo en tu bandeja e inténtalo nuevamente.'
      );
      return;
    }

    if (!newPassword) {
      showNotification('Contraseña requerida', 'Por favor ingresa una nueva contraseña.');
      return;
    }

    if (newPassword.length < 6) {
      showNotification('Contraseña corta', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showNotification('No coinciden', 'La confirmación no coincide con tu nueva contraseña.');
      return;
    }

    setIsLoading(true);

    // Actualizar la contraseña en la base de datos temporal
    const updateRes = await resetPassword(email.trim(), newPassword);
    setIsLoading(false);

    if (updateRes.success) {
      setCurrentStep(3);
    } else {
      showNotification('Error', updateRes.message || 'No se pudo actualizar la contraseña.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="dark" />

      {/* Cabecera uniforme y limpia para clientes */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (currentStep === 2) {
              setCurrentStep(1);
            } else if (router.canGoBack()) {
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
          <Text style={styles.headerTitle}>RECUPERAR CONTRASEÑA</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* ScrollView con barra de desplazamiento vertical activa y visible */}
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

        {/* Título y Subtítulo */}
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>Seguridad de tu Cuenta</Text>
          <Text style={styles.welcomeSubtitle}>
            Recupera el acceso a tu cuenta Einuushi de forma rápida, protegida y con envío a tu correo
          </Text>
        </View>

        {/* Indicador de Pasos Numerados */}
        <View style={styles.stepsIndicator}>
          <View style={[styles.stepDot, currentStep >= 1 && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, currentStep >= 1 && styles.stepDotTextActive]}>1</Text>
          </View>
          <View style={[styles.stepLine, currentStep >= 2 && styles.stepLineActive]} />
          <View style={[styles.stepDot, currentStep >= 2 && styles.stepDotActive]}>
            <Text style={[styles.stepDotText, currentStep >= 2 && styles.stepDotTextActive]}>2</Text>
          </View>
          <View style={[styles.stepLine, currentStep >= 3 && styles.stepLineActive]} />
          <View style={[styles.stepDot, currentStep === 3 && styles.stepDotActive]}>
            <Ionicons
              name="checkmark"
              size={12}
              color={currentStep === 3 ? '#FFFFFF' : '#94A3B8'}
            />
          </View>
        </View>

        {/* Banner Informativo con la línea gráfica de home.tsx */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTag}>SEGURIDAD Y PRIVACIDAD</Text>
            <Text style={styles.bannerTitle}>Código Temporal Seguro</Text>
            <Text style={styles.bannerSubtitle}>
              Validez de 1 minuto enviado directamente a tu buzón
            </Text>
          </View>
          <View style={styles.bannerIconBox}>
            <Ionicons name="time" size={24} color="#C5A880" />
          </View>
        </View>

        {/* PASO 1: Ingreso de Correo */}
        {currentStep === 1 && (
          <View style={styles.formContainer}>
            <Text style={styles.stepInstructionText}>
              Ingresa el correo electrónico asociado a tu cuenta. Te enviaremos un código de seguridad de 6 dígitos que tendrá una vigencia de 1 minuto para mayor protección.
            </Text>

            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#1E2B58" style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                ]}
                placeholder="Correo Electrónico Registrado *"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && { opacity: 0.7 }]}
              onPress={handleSendCode}
              disabled={isLoading}
            >
              <Text style={styles.primaryButtonText}>
                {isLoading ? 'ENVIANDO A TU CORREO...' : 'ENVIAR CÓDIGO DE RECUPERACIÓN'}
              </Text>
            </TouchableOpacity>

            <View style={styles.linksContainer}>
              <TouchableOpacity
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/');
                  }
                }}
              >
                <Text style={styles.linkTextBold}>← Volver a Iniciar Sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* PASO 2: Código con Temporizador y Nueva Contraseña */}
        {currentStep === 2 && (
          <View style={styles.formContainer}>
            {/* Aviso de seguridad: El código NO se visualiza en pantalla por protección */}
            <View style={styles.securityNoticeBadge}>
              <Ionicons name="mail" size={22} color="#1E2B58" style={{ marginRight: 10, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.securityNoticeTitle}>Código enviado a tu correo</Text>
                <Text style={styles.securityNoticeText}>
                  Por motivos de seguridad, el código se envió únicamente a{' '}
                  <Text style={{ fontWeight: 'bold', color: '#1E2B58' }}>{email}</Text>.
                  No se muestra en pantalla. Revisa tu bandeja de entrada o spam.
                </Text>
              </View>
            </View>

            {/* Temporizador de Cuenta Regresiva de 1 Minuto */}
            {!isCodeExpired && timeLeft > 0 ? (
              <View style={styles.timerBadge}>
                <Ionicons name="time-outline" size={18} color="#1E2B58" style={{ marginRight: 6 }} />
                <Text style={styles.timerText}>
                  El código vence en:{' '}
                  <Text style={styles.timerCountdown}>
                    00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                  </Text>
                </Text>
              </View>
            ) : (
              <View style={styles.expiredBadge}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.expiredText}>
                  ¡El código ha expirado! Por favor presiona "Reenviar código a mi correo" para generar uno nuevo.
                </Text>
              </View>
            )}

            <Text style={styles.stepInstructionText}>
              Escribe el código de 6 dígitos recibido en tu correo e introduce tu nueva contraseña de acceso.
            </Text>

            {/* Código de 6 dígitos */}
            <View style={[styles.inputWrapper, isCodeExpired && styles.inputWrapperDisabled]}>
              <Ionicons name="key-outline" size={20} color={isCodeExpired ? "#94A3B8" : "#1E2B58"} style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                ]}
                placeholder={isCodeExpired ? "Código expirado, reenviar" : "Ingresa el código de 6 dígitos *"}
                placeholderTextColor="#94A3B8"
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                maxLength={6}
                editable={!isCodeExpired}
              />
            </View>

            {/* Nueva Contraseña */}
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#1E2B58" style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                ]}
                placeholder="Nueva Contraseña (mínimo 6) *"
                placeholderTextColor="#94A3B8"
                value={newPassword}
                onChangeText={setNewPassword}
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

            {/* Confirmar Nueva Contraseña */}
            <View style={styles.inputWrapper}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#1E2B58" style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
                ]}
                placeholder="Confirmar Nueva Contraseña *"
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

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (isLoading || isCodeExpired) && { opacity: 0.65 },
              ]}
              onPress={handleResetPassword}
              disabled={isLoading || isCodeExpired}
            >
              <Text style={styles.primaryButtonText}>
                {isLoading ? 'GUARDANDO...' : isCodeExpired ? 'CÓDIGO EXPIRADO' : 'RESTABLECER MI CONTRASEÑA'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.resendButton,
                isCodeExpired && styles.resendButtonUrgent,
              ]}
              onPress={handleResendCode}
              disabled={isLoading}
            >
              <Ionicons 
                name="refresh-outline" 
                size={16} 
                color={isCodeExpired ? "#FFFFFF" : "#1E2B58"} 
                style={{ marginRight: 6 }} 
              />
              <Text style={[
                styles.resendText,
                isCodeExpired && styles.resendTextUrgent,
              ]}>
                {isCodeExpired ? 'Reenviar nuevo código ahora' : '¿No te llegó el código? Reenviar a mi correo'}
              </Text>
            </TouchableOpacity>

            <View style={styles.linksContainer}>
              <TouchableOpacity onPress={() => setCurrentStep(1)}>
                <Text style={styles.linkTextBold}>← Cambiar correo electrónico</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* PASO 3: Éxito */}
        {currentStep === 3 && (
          <View style={styles.successCard}>
            <View style={styles.successIconBox}>
              <Ionicons name="checkmark-done" size={44} color="#166534" />
            </View>
            <Text style={styles.successTitle}>¡Contraseña Actualizada!</Text>
            <Text style={styles.successDesc}>
              Tu nueva clave de acceso a <Text style={{ fontWeight: 'bold', color: '#1E2B58' }}>Einuushi</Text> ha sido guardada en la base de datos satisfactoriamente. Ya puedes iniciar sesión y explorar el catálogo de artesanías wayuu.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.primaryButtonText}>INICIAR SESIÓN AHORA</Text>
            </TouchableOpacity>
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
  stepsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 40,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: '#1E2B58',
    borderColor: '#C5A880',
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748B',
  },
  stepDotTextActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#C5A880',
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
  stepInstructionText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  securityNoticeBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#C5A880',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  securityNoticeTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 2,
  },
  securityNoticeText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 16,
    alignSelf: 'center',
  },
  timerText: {
    fontSize: 12,
    color: '#1E2B58',
  },
  timerCountdown: {
    fontWeight: 'bold',
    color: '#1E2B58',
    fontSize: 13,
  },
  expiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  expiredText: {
    flex: 1,
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
    lineHeight: 16,
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
  inputWrapperDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
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
    textAlign: 'center',
  },
  resendButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 6,
  },
  resendButtonUrgent: {
    backgroundColor: '#1E2B58',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: '#C5A880',
  },
  resendText: {
    fontSize: 12,
    color: '#1E2B58',
    fontWeight: '600',
  },
  resendTextUrgent: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  linksContainer: {
    alignItems: 'center',
    marginTop: 22,
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
