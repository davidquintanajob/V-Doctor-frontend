import React, { useState } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Platform, Text } from 'react-native';
import { Colors, Spacing, Typography } from '../variables';
import SidebarMenu from './SidebarMenu';

const TopBar = ({ onMenuNavigate = () => {}, onLogoPress = () => {} }) => {
    const [menuOpen, setMenuOpen] = useState(false);

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

                <View>
                    <Text style={styles.text}>Clínica Veterinaria</Text>
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

                    <TouchableOpacity style={[styles.iconButton, styles.userButton]} onPress={() => { }}>
                        <Image
                            source={require('../assets/images/user.png')}
                            style={styles.icon}
                            resizeMode="contain"
                        />
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
        backgroundColor: Colors.primary,
        paddingTop: Platform.OS === 'android' ? 10 : 0,
    },
    text:{
        color: Colors.textPrimary,
        fontSize: 20,
        marginLeft: -45,
        marginTop: 20,
        fontWeight: "bold",
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    logo: {
        width: 100,
        marginLeft: -15,
        height: 70,
        marginTop: 20,
        marginRight: 50
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
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
        backgroundColor: 'transparent'
    },
    userButton: {
        // user button shares same look but without explicit border requirement
    },
    icon: {
        width: 30,
        height: 30,
        tintColor: Colors.textPrimary,
    }
});

export default TopBar;
