import React, { useState, useEffect } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Platform, Text } from 'react-native';
import { Colors, Spacing, Typography } from '../variables';
import SidebarMenu from './SidebarMenu';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const TopBar = ({ onMenuNavigate = () => { }, onLogoPress = () => { } }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [isUserActive, setIsUserActive] = useState(false);
    const router = useRouter();

    // Verificar estado del usuario al cargar el componente
    useEffect(() => {
        const checkUserStatus = async () => {
            try {
                const configString = await AsyncStorage.getItem('@config');
                if (configString) {
                    const config = JSON.parse(configString);
                    // Verificar si existe token de usuario
                    if (config.token && config.usuario) {
                        setIsUserActive(true);
                    } else {
                        setIsUserActive(false);
                    }
                } else {
                    setIsUserActive(false);
                }
            } catch (error) {
                console.log('Error verificando estado del usuario:', error);
                setIsUserActive(false);
            }
        };

        checkUserStatus();
    }, []);

    return (
        <>
            <View style={styles.container}>
                <View style={styles.left}>
                    <TouchableOpacity onPress={() => onLogoPress()} activeOpacity={0.7}>
                        <Image
                            source={require('../assets/images/logo(con_borde_blanco).png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                </View>

                <View style={styles.center}>
                    <Text style={styles.text}>Veterinaria</Text>
                </View>

                <View style={styles.right}>
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => setMenuOpen(!menuOpen)}
                    >
                        <Image
                            source={require('../assets/images/menu.png')}
                            style={styles.icon}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.iconButton, styles.userButton]} onPress={() => { router.push('/perfil'); }}
                    >
                        <View style={styles.userButtonContainer}>
                            <Image
                                source={require('../assets/images/user.png')}
                                style={styles.icon}
                                resizeMode="contain"
                            />
                            {/* Indicador de estado */}
                            <View style={[
                                styles.statusIndicator,
                                isUserActive ? styles.statusActive : styles.statusInactive
                            ]}>
                                <Text style={styles.statusText}>
                                    {isUserActive ? 'Activo' : 'Discon'}
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            <SidebarMenu
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                onNavigate={onMenuNavigate}
            />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: 110,
        paddingHorizontal: Spacing.m,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.primary,
        paddingTop: Platform.OS === 'android' ? 10 : 0,
    },
    left: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    right: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    text: {
        color: Colors.textPrimary,
        fontSize: 20,
        fontWeight: "bold",
        marginTop: 20,
    },
    logo: {
        width: 100,
        height: 70,
        marginTop: 20,
    },
    iconButton: {
        marginLeft: Spacing.s,
        padding: 8,
        height: 50,
        width: 50,
        marginTop: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.primarySuave,
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userButton: {
        // user button shares same look but without explicit border requirement
    },
    userButtonContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    icon: {
        width: 30,
        height: 30,
        tintColor: Colors.textPrimary,
    },
    statusIndicator: {
        position: 'absolute',
        bottom: -8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusActive: {
        backgroundColor: '#4CAF50', // Verde
    },
    statusInactive: {
        backgroundColor: '#f44336', // Rojo
    },
    statusText: {
        color: 'white',
        fontSize: 8,
        fontWeight: 'bold',
        textAlign: 'center',
    },
});

export default TopBar;