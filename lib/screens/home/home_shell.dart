import 'package:flutter/material.dart';
import 'home_tab.dart';
import 'explore_tab.dart';
import 'compare_tab.dart';
import '../profile/profile_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tabIndex = 0;

  // Bumped each time the Compare tab is opened, so it rebuilds and reloads
  // the latest attempts instead of showing data from when the app started.
  int _compareVersion = 0;
  int _exploreVersion = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _tabIndex,
        children: [
          const HomeTab(),
          ExploreTab(key: ValueKey(_exploreVersion)),
          CompareTab(key: ValueKey(_compareVersion)),
          const ProfileScreen(embedded: true),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (i) => setState(() {
          if (i == 1) _exploreVersion++;
          if (i == 2) _compareVersion++;
          _tabIndex = i;
        }),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.explore_outlined), selectedIcon: Icon(Icons.explore), label: 'Explore'),
          NavigationDestination(icon: Icon(Icons.compare_arrows_outlined), selectedIcon: Icon(Icons.compare_arrows), label: 'Compare'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}