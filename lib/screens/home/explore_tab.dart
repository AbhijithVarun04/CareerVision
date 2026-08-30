import 'package:flutter/material.dart';
import '../../config/constants.dart';

class ExploreTab extends StatelessWidget {
  const ExploreTab({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Explore',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Card(
            child: ListTile(
              leading: const Icon(Icons.work_outline),
              title: const Text('Career Details'),
              subtitle: const Text('Requirements, skill gaps, path timeline'),
              onTap: () => Navigator.pushNamed(context, Routes.careerDetail),
            ),
          ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.school_outlined),
              title: const Text('Course Details'),
              onTap: () => Navigator.pushNamed(context, Routes.courseDetail),
            ),
          ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.location_city_outlined),
              title: const Text('Chennai College Finder'),
              onTap: () => Navigator.pushNamed(context, Routes.collegeFinder),
            ),
          ),
        ],
      ),
    );
  }
}