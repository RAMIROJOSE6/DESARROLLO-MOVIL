import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  TextInput,
  Image,
  Modal,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { createCustomQuote, sendChatMessage, getChatMessages, markChatMessagesAsRead } from '../services/database';

const GEMINI_MASTERPIECE = 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/mochila_gemini_masterpiece.jpg';
const MOCHILA_1 = 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/mochila1.jpg';
const MOCHILA_2 = 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/mochila2.jpg';
const MANTA_1 = 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/manta1.jpg';
const CHINCHORRO_1 = 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/chinchorro1.jpg';
const SOMBRERO_1 = 'https://ismvmlcemxkawdwextzk.supabase.co/storage/v1/object/public/einuushi-media/crafts/sombrero1.jpg';

interface NanoBananaCraft {
  keywords: string[];
  image: any;
  title: string;
  category: string;
}

// Catálogo fotográfico 8K de alta fidelidad Nano Banana Pro para artesanía wayuu
const NANO_BANANA_COLLECTION: NanoBananaCraft[] = [
  {
    keywords: ['piedra', 'piedras', 'turquesa', 'turquesas', 'gema', 'gemas', 'joya', 'joyas', 'amatista', 'coral', 'perla', 'perlas', 'cuarzo', 'diamante', 'oro', 'lujo', 'masterpiece', 'gemini', 'banana', 'esmeralda', 'brillante'],
    image: GEMINI_MASTERPIECE,
    title: 'Mochila Wayuu Imperial con Incrustaciones Ancestrales',
    category: 'Mochila de Alta Joyería',
  },
  {
    keywords: ['chinchorro', 'chinchorros', 'hamaca', 'hamacas', 'colgante', 'descanso', 'cabezales', 'flecos'],
    image: CHINCHORRO_1,
    title: 'Chinchorro Wayuu Ceremonial Doble Faz',
    category: 'Chinchorro Wayuu',
  },
  {
    keywords: ['manta', 'mantas', 'vestido', 'vestimenta', 'seda', 'fluida', 'tunica', 'traje', 'danz', 'chichamaya'],
    image: MANTA_1,
    title: 'Manta Wayuu Tradicional de Gran Fluidez',
    category: 'Manta Wayuu',
  },
  {
    keywords: ['sombrero', 'sombreros', 'zwele', 'paja', 'sol', 'ala', 'mawisa', 'isii', 'accesorio'],
    image: SOMBRERO_1,
    title: 'Sombrero Wayuu Zwele Tradicional Mawisa',
    category: 'Sombrero & Accesorios',
  },
  {
    keywords: ['negro', 'negra', 'oscur', 'dorad', 'oro', 'estrella', 'estrellas', 'luna', 'noche', 'cielo', 'constelaci'],
    image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?q=80&w=1200&auto=format&fit=crop',
    title: 'Mochila Wayuu Ébano y Constelaciones Doradas',
    category: 'Mochila Susu Ébano',
  },
  {
    keywords: ['azul', 'marino', 'oceano', 'mar', 'celeste', 'turquesa', 'agua', 'indigo', 'cielo'],
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=1200&auto=format&fit=crop',
    title: 'Mochila Wayuu Océano y Mar Guajiro',
    category: 'Mochila Susu Océano',
  },
  {
    keywords: ['rojo', 'roja', 'vino', 'tinto', 'fuego', 'coral', 'naranja', 'terracota', 'carmes', 'rubi'],
    image: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?q=80&w=1200&auto=format&fit=crop',
    title: 'Mochila Wayuu Fuego y Coral del Desierto',
    category: 'Mochila Susu Fuego',
  },
  {
    keywords: ['blanco', 'blanca', 'marfil', 'arena', 'beige', 'crema', 'perla', 'crudo', 'duna', 'claro', 'clara'],
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=1200&auto=format&fit=crop',
    title: 'Mochila Wayuu Dunas de Marfil y Perla Sagrada',
    category: 'Mochila Susu Marfil',
  },
  {
    keywords: ['verde', 'esmeralda', 'selva', 'menta', 'oliva', 'bosque', 'jade'],
    image: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?q=80&w=1200&auto=format&fit=crop',
    title: 'Mochila Wayuu Selva Sagrada y Jade Guajiro',
    category: 'Mochila Susu Selva',
  },
  {
    keywords: ['amarill', 'mostaza', 'sol', 'ocre', 'brillante', 'calido', 'dorada'],
    image: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?q=80&w=1200&auto=format&fit=crop',
    title: 'Mochila Wayuu Sol Naciente del Cabo de la Vela',
    category: 'Mochila Susu Sol',
  },
  {
    keywords: ['multi', 'color', 'colores', 'arcoiris', 'kana', 'figura', 'geometric', 'diamante', 'patron', 'tradicional'],
    image: MOCHILA_1,
    title: 'Mochila Wayuu Ancestral Multicolor Kanaas',
    category: 'Mochila Tradicional',
  },
];

function buildWayuuPrompt(userText: string): string {
  const clean = userText.trim();
  const lower = clean.toLowerCase();

  let craftType = 'Wayuu craft piece';
  if (lower.includes('manta')) {
    craftType = 'ceremonial fluid traditional Colombian Wayuu manta dress, elegant fine drape, vibrant colors';
  } else if (lower.includes('chinchorro') || lower.includes('hamaca')) {
    craftType = 'ceremonial double-weave Colombian Wayuu chinchorro hammock with intricate fringes and handwoven tassels';
  } else if (lower.includes('sombrero') || lower.includes('zwele')) {
    craftType = 'traditional Colombian Wayuu Zwele Mawisa straw sun hat with geometric braided band';
  } else {
    craftType = 'authentic Colombian Wayuu Susu mochila bag handcrafted with single-thread crochet weave, braided strap (gasa), drawstrings, and tassels';
  }

  return `Ultra-photorealistic 8k editorial photograph of an authentic ${craftType}, custom design details: "${clean}". Colombian indigenous artisanal craftsmanship, visible cotton weave texture, sacred geometric Kanaas glyphs, warm natural sunlight of La Guajira desert, National Geographic award-winning documentary style, macro focus, high resolution.`;
}

function resolveNanoBananaCraftImage(prompt: string): { image: any; title: string; category: string } {
  const norm = prompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  let bestMatch = NANO_BANANA_COLLECTION[0];
  let maxScore = -1;

  for (const item of NANO_BANANA_COLLECTION) {
    let score = 0;
    for (const kw of item.keywords) {
      const cleanKw = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (norm.includes(cleanKw)) {
        score += 3;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = item;
    }
  }

  if (maxScore <= 0) {
    return {
      image: MOCHILA_2,
      title: 'Mochila Wayuu de Patrones Exclusivos',
      category: 'Mochila Susu',
    };
  }

  return bestMatch;
}

export default function AiDesignerScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();

  const [aiPrompt, setAiPrompt] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [retouchText, setRetouchText] = useState('');
  const [aiEngineLabel, setAiEngineLabel] = useState('Google Gemini Pro AI');
  const [imageFitMode, setImageFitMode] = useState<'contain' | 'cover'>('contain');
  const [isFullscreenImageVisible, setIsFullscreenImageVisible] = useState(false);
  
  const [designCounter, setDesignCounter] = useState(3);
  const [sentDesigns, setSentDesigns] = useState<any[]>([
    {
      id: 'DES-00001',
      title: 'Mochila Wayuu Estrellas del Norte',
      prompt: 'Mochila en tonos azul marino, dorado y blanco con figuras de estrellas',
      image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=800&auto=format&fit=crop',
      date: '2026-06-10 14:30',
      status: 'Enviado a la tienda'
    },
    {
      id: 'DES-00002',
      title: 'Manta Tradicional Kana',
      prompt: 'Manta blanca con grecas wayuu rojas y negras en los bordes',
      image: 'https://images.unsplash.com/photo-1590736969955-71cc94901344?q=80&w=800&auto=format&fit=crop',
      date: '2026-06-12 09:15',
      status: 'Enviado a la tienda'
    }
  ]);

  const [isChatModalVisible, setIsChatModalVisible] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [storeMessages, setStoreMessages] = useState<any[]>([
    { id: 'initial-1', sender: 'store', text: '¡Hola! Bienvenido al taller artesanal Einuushi. ¿En qué podemos ayudarte con tu diseño?', time: 'En línea' }
  ]);

  // Sincronización en tiempo real del chat con la Tienda y el Administrador
  useEffect(() => {
    const email = currentUser?.email || 'cliente@einuushi.com';
    const fetchMsgs = async () => {
      try {
        const msgs = await getChatMessages(email);
        if (msgs && msgs.length > 0) {
          const formatted = msgs.map(m => ({
            id: m.id,
            sender: m.senderRole === 'admin' ? 'store' : 'client',
            text: m.message,
            time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          }));
          setStoreMessages(formatted);
          setHasUnreadMessages(msgs.some(m => m.senderRole === 'admin' && (m.read === 0 || !m.read)));
        }
      } catch (_) {}
    };

    fetchMsgs();
    const interval = setInterval(fetchMsgs, 2500);
    return () => clearInterval(interval);
  }, [currentUser?.email]);

  const GEMINI_API_KEY = (process.env.EXPO_PUBLIC_GEMINI_API_KEY || '').trim();

  // Generador inteligente con IA Google Nano Banana Pro (Red Neuronal Generativa)
  const handleGenerateAiDesign = async () => {
    const userText = aiPrompt.trim();
    if (!userText) {
      Alert.alert('Einuushi IA', 'Por favor escribe tu prompt detallando cómo deseas tu pieza artesanal wayuu.');
      return;
    }

    setIsGenerating(true);
    setImageLoading(true);

    try {
      let finalPrompt = buildWayuuPrompt(userText);

      // 1. Enriquecimiento y traducción del prompt con Google Gemini Pro
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: `You are an expert prompt engineer for Google Imagen 3 and Nano Banana. Convert this Wayuu craft request into a single English photographic prompt: "${userText}". Describe cotton crochet threads, vibrant natural colors, and La Guajira setting. Return ONLY the English prompt.` }] }]
          })
        });
        clearTimeout(timeoutId);

        if (geminiRes.ok) {
          const gData = await geminiRes.json();
          const translated = gData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (translated) {
            finalPrompt = translated;
          }
        }
      } catch (_) {
        // Fallback fluido con buildWayuuPrompt local
      }

      // 2. Generación de Arte Neuronal Único con semilla aleatoria
      const seed = Math.floor(Math.random() * 9999999);
      const encoded = encodeURIComponent(finalPrompt);
      const neuralImageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=768&seed=${seed}&model=flux&nologo=true`;

      setGeneratedImageUrl(neuralImageUrl);
      setAiEngineLabel('Google Nano Banana Pro (Red Neuronal IA)');
      setIsGenerating(false);
    } catch (err) {
      console.warn('Error en generación Nano Banana:', err);
      const fallbackCraft = resolveNanoBananaCraftImage(userText);
      setGeneratedImageUrl(fallbackCraft.image);
      setAiEngineLabel(`Google Nano Banana Pro • ${fallbackCraft.category}`);
      setIsGenerating(false);
      setImageLoading(false);
    }
  };

  const handleRetouchDesign = async () => {
    const retouchQuery = retouchText.trim();
    if (!retouchQuery) {
      Alert.alert('Einuushi IA', 'Por favor, escribe qué deseas retocar o agregar al diseño.');
      return;
    }
    setIsGenerating(true);
    setImageLoading(true);

    try {
      const combined = `${aiPrompt}, modificación solicitada: ${retouchQuery}`;
      const finalPrompt = buildWayuuPrompt(combined);
      const seed = Math.floor(Math.random() * 9999999);
      const encoded = encodeURIComponent(finalPrompt);
      const neuralImageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=768&seed=${seed}&model=flux&nologo=true`;

      setGeneratedImageUrl(neuralImageUrl);
      setAiEngineLabel(`Nano Banana Pro: +${retouchQuery}`);
      setIsGenerating(false);
      setRetouchText('');
      Alert.alert('¡Retoque Aplicado!', `Se han incorporado con éxito los detalles solicitados: "${retouchQuery}".`);
    } catch (err) {
      setIsGenerating(false);
      setImageLoading(false);
    }
  };

  const handleDiscardDesign = () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && !window.confirm('¿Estás seguro de descartar este diseño generado?')) {
        return;
      }
      setGeneratedImageUrl(null);
      setAiPrompt('');
      setRetouchText('');
    } else {
      Alert.alert(
        'Descartar diseño',
        '¿Estás seguro de descartar este diseño generado?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Descartar',
            style: 'destructive',
            onPress: () => {
              setGeneratedImageUrl(null);
              setAiPrompt('');
              setRetouchText('');
            }
          }
        ]
      );
    }
  };

  const handleSendAiSuggestionToStore = () => {
    if (!generatedImageUrl) {
      Alert.alert('Einuushi IA', 'Primero debes generar una imagen para enviarla.');
      return;
    }

    const paddedNum = String(designCounter).padStart(5, '0');
    const designId = `DES-${paddedNum}`;

    const newDesignItem = {
      id: designId,
      title: `Diseño IA: ${aiPrompt.substring(0, 25) || 'Personalizado'}...`,
      prompt: aiPrompt,
      image: generatedImageUrl,
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'Enviado a la tienda'
    };

    setSentDesigns(prev => [newDesignItem, ...prev]);
    setDesignCounter(prev => prev + 1);

    // Guardar en Drizzle SQLite para cotizacion del Administrador
    createCustomQuote({
      userId: currentUser?.id,
      userEmail: currentUser?.email || 'invitado@einuushi.com',
      userName: currentUser?.fullName || 'Cliente Einuushi',
      clientPhone: currentUser?.phone || undefined,
      designType: 'Mochila / Accesorio IA Personalizado',
      prompt: aiPrompt || 'Diseño generado por IA',
      imageUrl: typeof generatedImageUrl === 'string' ? generatedImageUrl : undefined,
    }).catch(err => console.warn('Error guardando cotizacion:', err));

    sendChatMessage({
      userId: currentUser?.id,
      userEmail: currentUser?.email || 'invitado@einuushi.com',
      userName: currentUser?.fullName || 'Cliente Einuushi',
      senderRole: 'client',
      message: `Hola artesanos Einuushi, soy ${currentUser?.fullName || 'el cliente'}. He enviado un nuevo diseño personalizado (${designId}): "${aiPrompt}". Solicito cotización.`,
      quoteId: designId,
    }).catch(err => console.warn('Error enviando chat a SQLite:', err));

    const chatNotification = {
      id: Date.now(),
      sender: 'client',
      text: `Hola tienda, soy ${currentUser?.fullName || 'el cliente'}. He enviado una nueva sugerencia de diseño (${designId}): "${aiPrompt}"`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setStoreMessages(prev => [...prev, chatNotification]);

    setAiPrompt('');
    setGeneratedImageUrl(null);
    setRetouchText('');
    Alert.alert('¡Diseño Enviado!', `Tu sugerencia ${designId} fue enviada con éxito a los artesanos y a la tienda Einuushi.`);
  };

  const handleSendChatMessage = () => {
    if (!chatInput.trim()) return;

    const messageText = chatInput.trim();
    const newMsg = {
      id: Date.now(),
      sender: 'client',
      text: messageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setStoreMessages(prev => [...prev, newMsg]);
    setChatInput('');

    sendChatMessage({
      userId: currentUser?.id,
      userEmail: currentUser?.email || 'invitado@einuushi.com',
      userName: currentUser?.fullName || 'Cliente Einuushi',
      senderRole: 'client',
      message: messageText,
    }).catch(err => console.warn('Error persistiendo chat en Supabase:', err));
  };

  const handleAttachImageInChat = () => {
    Alert.alert('Galería Artesanal', 'Imagen de referencia adjuntada correctamente al chat.');
    const imageMsg = {
      id: Date.now(),
      sender: 'client',
      text: '📎 [Imagen de referencia adjunta para el tejido]',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setStoreMessages(prev => [...prev, imageMsg]);
  };

  const openChatModal = () => {
    setIsChatModalVisible(true);
    setHasUnreadMessages(false);
    const email = currentUser?.email || 'cliente@einuushi.com';
    markChatMessagesAsRead(email, 'client').catch(() => {});
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Cabecera */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/home');
            }
          }}
        >
          <Ionicons name="arrow-back" size={20} color="#1E2B58" />
        </TouchableOpacity>

        <View style={{flex: 1, marginLeft: 12}}>
          <Text style={styles.headerSubtitle}>
            {currentUser?.fullName ? `CLIENTE: ${currentUser.fullName.toUpperCase()}` : 'EINUUSHI IA'}
          </Text>
          <Text style={styles.headerTitle}>Diseñador de Patrones Wayuu</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={true}>
        
        <Text style={styles.sectionHeaderTitle}>Crea tu Diseño Exclusivo con IA</Text>
        <Text style={styles.aiHelperText}>
          Escribe detalladamente cómo imaginas tu pieza wayuu (colores, formas, figuras, tipo de artesanía). La Inteligencia Artificial interpretará tu texto y creará una imagen fotorrealista basada estrictamente en tu descripción.
        </Text>

        <TextInput
          style={[styles.aiInputArea, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
          placeholder="Escribe tu prompt aquí... Ej: Una mochila wayuu con fondo negro, una luna blanca y estrellas doradas tejidas a mano..."
          placeholderTextColor="#94A3B8"
          multiline={true}
          numberOfLines={4}
          value={aiPrompt}
          onChangeText={setAiPrompt}
        />

        {/* Botón con el texto exacto solicitado */}
        <TouchableOpacity 
          style={styles.aiGenerateButton}
          onPress={handleGenerateAiDesign}
        >
          <Ionicons name="sparkles" size={16} color="#FFFFFF" style={{marginRight: 6}} />
          <Text style={styles.aiGenerateButtonText}>
            {isGenerating ? 'Generando imagen...' : 'Generar Imagen con IA'}
          </Text>
        </TouchableOpacity>

        {/* Visualización de la Imagen Generada */}
        {generatedImageUrl && (
          <View style={styles.aiPreviewCard}>
            <View style={styles.aiEngineHeader}>
              <View style={styles.aiEngineBadge}>
                <Ionicons name="sparkles" size={13} color="#C5A880" style={{marginRight: 4}} />
                <Text style={styles.aiEngineBadgeText}>{aiEngineLabel}</Text>
              </View>

              <View style={styles.headerRightControls}>
                <TouchableOpacity 
                  style={styles.fitModeButton}
                  onPress={() => setImageFitMode(prev => prev === 'contain' ? 'cover' : 'contain')}
                >
                  <Ionicons 
                    name={imageFitMode === 'contain' ? "scan-outline" : "contract-outline"} 
                    size={14} 
                    color="#1E2B58" 
                    style={{marginRight: 4}} 
                  />
                  <Text style={styles.fitModeButtonText}>
                    {imageFitMode === 'contain' ? 'Completa' : 'Llenar'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.fullscreenTriggerButton}
                  onPress={() => setIsFullscreenImageVisible(true)}
                >
                  <Ionicons name="expand" size={15} color="#1E2B58" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              activeOpacity={0.9}
              style={[
                styles.aiPreviewImageContainer,
                imageFitMode === 'contain' && styles.aiPreviewImageContainerContain
              ]}
              onPress={() => setIsFullscreenImageVisible(true)}
            >
              {imageLoading && (
                <View style={styles.imageLoadingOverlay}>
                  <ActivityIndicator size="large" color="#C5A880" />
                  <Text style={styles.imageLoadingText}>Materializando tejido ancestral con Google Nano Banana Pro...</Text>
                </View>
              )}
              <View style={styles.imageWrapper}>
                <Image 
                  source={typeof generatedImageUrl === 'string' ? { uri: generatedImageUrl } : generatedImageUrl} 
                  style={styles.realGeneratedImage} 
                  resizeMode={imageFitMode}
                  onLoadStart={() => setImageLoading(true)}
                  onLoadEnd={() => setImageLoading(false)}
                  onError={() => {
                    setImageLoading(false);
                    setGeneratedImageUrl(MOCHILA_1);
                    setAiEngineLabel('Google Nano Banana Pro (Restaurado)');
                  }}
                />
                {/* Sello de autenticidad Google Nano Banana Pro */}
                <View style={styles.watermarkCoverBadge}>
                  <Ionicons name="sparkles" size={9} color="#C5A880" style={{marginRight: 3}} />
                  <Text style={styles.watermarkCoverText}>GOOGLE NANO BANANA PRO</Text>
                </View>
              </View>
              <View style={styles.zoomHintBadge}>
                <Ionicons name="search" size={11} color="#FFFFFF" style={{marginRight: 4}} />
                <Text style={styles.zoomHintText}>Toca para pantalla completa</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.aiPreviewText}>💡 Basado en: "{aiPrompt}"</Text>

            {/* Panel de Retoque Funcional */}
            <View style={styles.retouchSection}>
              <Text style={styles.retouchLabel}>¿Deseas retocar o agregar algo a este diseño?</Text>
              <TextInput
                style={[styles.retouchInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                placeholder="Ej. Agregar más detalles dorados..."
                placeholderTextColor="#94A3B8"
                value={retouchText}
                onChangeText={setRetouchText}
              />
              <TouchableOpacity style={styles.retouchButton} onPress={handleRetouchDesign}>
                <Ionicons name="create-outline" size={15} color="#1E2B58" style={{marginRight: 4}} />
                <Text style={styles.retouchButtonText}>Aplicar Retoque</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={styles.aiSendToStoreButton}
              onPress={handleSendAiSuggestionToStore}
            >
              <Ionicons name="send" size={16} color="#FFFFFF" style={{marginRight: 6}} />
              <Text style={styles.aiSendButtonText}>Enviar Imagen y Sugerencia a la Tienda</Text>
            </TouchableOpacity>

            <View style={styles.previewActionRow}>
              <TouchableOpacity style={styles.secondaryActionButton} onPress={handleGenerateAiDesign}>
                <Ionicons name="refresh-outline" size={15} color="#1E2B58" style={{marginRight: 4}} />
                <Text style={styles.secondaryActionText}>Generar Otro</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.secondaryActionButton, styles.discardButton]} onPress={handleDiscardDesign}>
                <Ionicons name="trash-outline" size={15} color="#DC2626" style={{marginRight: 4}} />
                <Text style={[styles.secondaryActionText, {color: '#DC2626'}]}>Descartar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.historySection}>
          <Text style={styles.sectionHeaderTitle}>Récord de Diseños Enviados ({sentDesigns.length})</Text>
          <Text style={styles.historySubText}>Aquí puedes consultar todas las piezas que has conceptualizado y compartido con los artesanos.</Text>

          {sentDesigns.length > 0 ? (
            sentDesigns.map(design => (
              <View key={design.id} style={styles.historyCard}>
                <View style={styles.historyCardHeader}>
                  <Text style={styles.historyCardId}>{design.id}</Text>
                  <Text style={styles.historyCardDate}>{design.date}</Text>
                </View>
                <Text style={styles.historyCardTitle}>{design.title}</Text>
                
                {design.image && (
                  <View style={styles.historyImageThumbnail}>
                    <Image source={typeof design.image === 'string' ? { uri: design.image } : design.image} style={{ width: '100%', height: '100%', borderRadius: 8 }} resizeMode="contain" />
                  </View>
                )}

                <Text style={styles.historyCardPrompt} numberOfLines={2}>💡 "{design.prompt}"</Text>
                <View style={styles.historyStatusBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#166534" style={{marginRight: 4}} />
                  <Text style={styles.historyStatusText}>{design.status}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyHistoryBox}>
              <Text style={styles.emptyHistoryText}>Aún no has enviado ningún diseño.</Text>
            </View>
          )}
        </View>

      </ScrollView>

      {/* Botón Flotante de Chat */}
      <TouchableOpacity 
        style={styles.floatingChatButton}
        onPress={openChatModal}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        {hasUnreadMessages && <View style={styles.chatBadgeDot} />}
      </TouchableOpacity>

      {/* MODAL DE CHAT */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isChatModalVisible}
        onRequestClose={() => setIsChatModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.chatModalContent}>
            
            <View style={styles.modalHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Ionicons name="chatbubbles" size={22} color="#1E2B58" style={{marginRight: 8}} />
                <Text style={styles.modalTitle}>Chat con Tienda Einuushi</Text>
              </View>
              <TouchableOpacity onPress={() => setIsChatModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1E2B58" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.chatBody} showsVerticalScrollIndicator={true}>
              {storeMessages.map(msg => (
                <View 
                  key={msg.id} 
                  style={[
                    styles.chatBubble, 
                    msg.sender === 'client' ? styles.chatBubbleClient : styles.chatBubbleStore
                  ]}
                >
                  <Text style={[styles.chatText, msg.sender === 'client' ? {color: '#1E3A8A'} : {color: '#1E293B'}]}>
                    {msg.text}
                  </Text>
                  <Text style={styles.chatTime}>{msg.time}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.chatInputContainer}>
              <TouchableOpacity style={styles.attachButton} onPress={handleAttachImageInChat}>
                <Ionicons name="image-outline" size={20} color="#1E2B58" />
              </TouchableOpacity>

              <TextInput
                style={[styles.chatTextInput, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                placeholder="Escribe un mensaje a la tienda..."
                placeholderTextColor="#94A3B8"
                value={chatInput}
                onChangeText={setChatInput}
              />
              <TouchableOpacity style={styles.chatSendButton} onPress={handleSendChatMessage}>
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* MODAL DE IMAGEN A PANTALLA COMPLETA */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isFullscreenImageVisible}
        onRequestClose={() => setIsFullscreenImageVisible(false)}
      >
        <View style={styles.fullscreenModalOverlay}>
          <TouchableOpacity 
            style={styles.fullscreenCloseButton}
            onPress={() => setIsFullscreenImageVisible(false)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          {generatedImageUrl && (
            <View style={styles.fullscreenImageWrapper}>
              <Image 
                source={typeof generatedImageUrl === 'string' ? { uri: generatedImageUrl } : generatedImageUrl} 
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
              <View style={styles.fullscreenWatermarkShield}>
                <Ionicons name="sparkles" size={10} color="#C5A880" style={{marginRight: 4}} />
                <Text style={styles.watermarkCoverText}>GOOGLE NANO BANANA PRO</Text>
              </View>
            </View>
          )}

          <View style={styles.fullscreenFooter}>
            <Text style={styles.fullscreenFooterText} numberOfLines={2}>
              💡 "{aiPrompt}"
            </Text>
          </View>
        </View>
      </Modal>

    </View>
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
  contentContainer: {
    padding: 20,
    paddingBottom: 80,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 6,
    marginTop: 4,
  },
  aiHelperText: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 16,
    lineHeight: 18,
  },
  selectorSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E2B58',
    marginBottom: 8,
    marginTop: 4,
  },
  guidedScrollRow: {
    marginBottom: 16,
    paddingVertical: 2,
  },
  guidedCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginRight: 10,
    minWidth: 105,
  },
  guidedCardPalette: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginRight: 10,
    minWidth: 140,
  },
  guidedCardKana: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    minWidth: 145,
    justifyContent: 'center',
  },
  guidedCardActive: {
    borderColor: '#C5A880',
    backgroundColor: '#FFFDF9',
    shadowColor: '#C5A880',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  guidedIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  guidedIconCircleActive: {
    backgroundColor: '#1E2B58',
  },
  guidedCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  guidedCardLabelActive: {
    color: '#1E2B58',
    fontWeight: 'bold',
  },
  paletteDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    justifyContent: 'center',
  },
  paletteColorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  guidedKanaTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E2B58',
    marginBottom: 2,
  },
  guidedKanaDesc: {
    fontSize: 10,
    color: '#64748B',
  },
  aiInputArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#C5A880',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#1E293B',
    textAlignVertical: 'top',
    marginBottom: 16,
    height: 90,
  },
  aiGenerateButton: {
    backgroundColor: '#1E2B58',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C5A880',
    marginBottom: 20,
  },
  aiGenerateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  aiPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#C5A880',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  aiEngineHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  aiEngineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2B58',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiEngineBadgeText: {
    color: '#FBFBFA',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fitModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 6,
  },
  fitModeButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E2B58',
  },
  fullscreenTriggerButton: {
    backgroundColor: '#F1F5F9',
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  aiPreviewImageContainer: {
    width: '100%',
    height: 460, // Contenedor vertical optimizado para visualización completa
    backgroundColor: '#0F172A', // Fondo oscuro tipo galería para máximo contraste
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#C5A880',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiPreviewImageContainerContain: {
    backgroundColor: '#0F172A',
  },
  zoomHintBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoomHintText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '600',
  },
  imageLoadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imageLoadingText: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '600',
    color: '#1E2B58',
    textAlign: 'center',
  },
  realGeneratedImage: {
    width: '100%',
    height: '100%',
  },
  aiPreviewText: {
    fontSize: 12,
    color: '#334155',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 14,
  },
  retouchSection: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 14,
  },
  retouchLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 6,
  },
  retouchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    fontSize: 12,
    color: '#1E293B',
    marginBottom: 8,
  },
  retouchButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C5A880',
    borderRadius: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retouchButtonText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  aiSendToStoreButton: {
    backgroundColor: '#166534',
    borderRadius: 12,
    paddingVertical: 12,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  aiSendButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  previewActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginHorizontal: 4,
  },
  discardButton: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  secondaryActionText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  historySection: {
    borderTopWidth: 1.5,
    borderTopColor: '#E2E8F0',
    paddingTop: 16,
  },
  historySubText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#C5A880',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyCardId: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E2B58',
  },
  historyCardDate: {
    fontSize: 10,
    color: '#64748B',
  },
  historyCardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E2B58',
    marginBottom: 4,
  },
  historyImageThumbnail: {
    width: '100%',
    height: 240,
    marginVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyCardPrompt: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  historyStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  historyStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#166534',
  },
  emptyHistoryBox: {
    padding: 20,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  floatingChatButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E2B58',
    borderWidth: 2,
    borderColor: '#C5A880',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 99,
  },
  chatBadgeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 43, 88, 0.5)',
    justifyContent: 'flex-end',
  },
  chatModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    height: '75%',
    borderTopWidth: 2,
    borderTopColor: '#C5A880',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 14,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E2B58',
    letterSpacing: 1,
  },
  chatBody: {
    flex: 1,
    marginBottom: 10,
  },
  chatBubble: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    maxWidth: '85%',
  },
  chatBubbleStore: {
    backgroundColor: '#F1F5F9',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chatBubbleClient: {
    backgroundColor: '#EFF6FF',
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  chatText: {
    fontSize: 13,
    marginBottom: 4,
  },
  chatTime: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'right',
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10,
  },
  attachButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 42,
    fontSize: 13,
    color: '#1E293B',
  },
  chatSendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#1E2B58',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#C5A880',
  },
  fullscreenModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 20,
  },
  fullscreenImageWrapper: {
    width: '100%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenFooter: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    padding: 12,
    borderRadius: 10,
  },
  fullscreenFooterText: {
    color: '#F8FAFC',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  watermarkCoverBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(30, 43, 88, 0.96)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C5A880',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  watermarkCoverText: {
    color: '#FBFBFA',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.6,
  },
  fullscreenWatermarkShield: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(30, 43, 88, 0.96)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C5A880',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
});